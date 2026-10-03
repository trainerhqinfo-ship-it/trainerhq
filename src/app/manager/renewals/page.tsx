import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import Link from "next/link";
import { RefreshCw, Eye } from "lucide-react";

type TabKey = "all" | "expired" | "today" | "7days" | "30days";

function daysLabel(days: number) {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  return `${days}d left`;
}

function daysClass(days: number) {
  if (days < 0) return "text-red-400";
  if (days === 0) return "text-orange-400";
  if (days <= 7) return "text-amber-400";
  return "text-[#9B9E96]";
}

export default async function RenewalsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const activeTab: TabKey = (["all", "expired", "today", "7days", "30days"].includes(tabParam ?? "") ? tabParam : "all") as TabKey;

  const profile = await getProfile();
  if (!profile) redirect("/login");
  const { gymId } = profile;

  const supabase = await createClient();

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const todayMS = new Date(today + "T00:00:00").getTime();

  const [{ data: packagesRaw }, { data: assignmentsRaw }] = await Promise.all([
    supabase
      .from("pt_packages")
      .select("id, client_id, package_name, start_date, end_date, amount_collected, created_at, pt_clients(id, first_name, last_name, phone)")
      .eq("gym_id", gymId)
      .order("start_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("pt_assignments")
      .select("client_id, trainer_id, id, trainers(first_name, last_name)")
      .eq("gym_id", gymId)
      .eq("status", "active"),
  ]);

  const packagesAll = (packagesRaw as any[] | null) ?? [];
  const assignmentsAll = (assignmentsRaw as any[] | null) ?? [];

  // Trainer lookup by client_id
  const trainerByClientId = new Map<string, { name: string; id: string }>();
  for (const a of assignmentsAll) {
    if (!trainerByClientId.has(a.client_id)) {
      const t = (a as any).trainers;
      trainerByClientId.set(a.client_id, {
        id: a.trainer_id,
        name: t ? `${t.first_name} ${t.last_name}` : "",
      });
    }
  }

  // Latest package per client (already sorted newest-first)
  const latestPkgByClient = new Map<string, any>();
  for (const pkg of packagesAll) {
    if (!latestPkgByClient.has(pkg.client_id)) {
      latestPkgByClient.set(pkg.client_id, pkg);
    }
  }

  // Build entries — no 30-day upper limit on this page
  interface Entry {
    clientId: string;
    clientName: string;
    clientPhone: string | null;
    trainerName: string | null;
    packageId: string;
    packageName: string | null;
    startDate: string | null;
    endDate: string;
    daysUntilExpiry: number;
    amountCollected: number | null;
    tab: TabKey;
  }

  const entries: Entry[] = [];
  for (const [clientId, pkg] of latestPkgByClient) {
    if (!pkg.end_date) continue;
    const endMS = new Date(pkg.end_date + "T00:00:00").getTime();
    const days = Math.round((endMS - todayMS) / 86400000);
    if (days > 30) continue; // cap at 30 days upcoming
    const c = (pkg as any).pt_clients;
    const trainerInfo = trainerByClientId.get(clientId);
    entries.push({
      clientId,
      clientName: c ? `${c.first_name} ${c.last_name}` : "Unknown",
      clientPhone: c?.phone ?? null,
      trainerName: trainerInfo?.name ?? null,
      packageId: pkg.id,
      packageName: pkg.package_name ?? null,
      startDate: pkg.start_date,
      endDate: pkg.end_date,
      daysUntilExpiry: days,
      amountCollected: pkg.amount_collected ?? null,
      tab: days < 0 ? "expired" : days === 0 ? "today" : days <= 7 ? "7days" : "30days",
    });
  }
  entries.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

  const filtered = activeTab === "all" ? entries : entries.filter((e) => e.tab === activeTab);

  const counts = {
    all: entries.length,
    expired: entries.filter((e) => e.tab === "expired").length,
    today: entries.filter((e) => e.tab === "today").length,
    "7days": entries.filter((e) => e.tab === "7days").length,
    "30days": entries.filter((e) => e.tab === "30days").length,
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "expired", label: "Expired" },
    { key: "today", label: "Due Today" },
    { key: "7days", label: "Due in 7 Days" },
    { key: "30days", label: "Due in 30 Days" },
  ];

  return (
    <div>
      <Header
        title="PT Renewals"
        subtitle="Clients with expiring or expired PT packages"
      />
      <div className="px-6 md:px-8 py-5 space-y-5">
        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1">
          {tabs.map(({ key, label }) => {
            const count = counts[key];
            const isActive = activeTab === key;
            return (
              <Link
                key={key}
                href={`/manager/renewals?tab=${key}`}
                className={`flex-shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-medium transition-colors ${
                  isActive
                    ? "bg-[#B9E84A] text-[#171917]"
                    : "bg-[#222520] border border-[#2E3129] text-[#9B9E96] hover:bg-[#1A1C18]"
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? "bg-[#171917]/20 text-[#171917]"
                      : key === "expired"
                      ? "bg-red-500/15 text-red-400"
                      : "bg-[#2E3129] text-[#9B9E96]"
                  }`}>
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Table */}
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-[#2E3129]">
                  {["Client", "Trainer", "Package", "Amount Paid", "Start Date", "Expiry Date", "Days", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B6E67] uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.clientId} className="border-b border-[#1A1C18] last:border-0 hover:bg-[#1A1C18]/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-[#E8EBE4]">{entry.clientName}</div>
                      {entry.clientPhone && <div className="text-[11px] text-[#6B6E67]">{entry.clientPhone}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#9B9E96]">
                      {entry.trainerName ?? <span className="text-[#4A4D47] italic">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#9B9E96]">
                      {entry.packageName ?? <span className="text-[#4A4D47]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-[#E8EBE4]">
                      {entry.amountCollected != null
                        ? `₹${entry.amountCollected.toLocaleString("en-IN")}`
                        : <span className="text-[#4A4D47]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#9B9E96]">
                      {entry.startDate ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#9B9E96]">{entry.endDate}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-semibold tabular-nums ${daysClass(entry.daysUntilExpiry)}`}>
                        {daysLabel(entry.daysUntilExpiry)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/manager/clients/${entry.clientId}`}
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-[#2E3129] text-[11px] text-[#9B9E96] hover:bg-[#1A1C18] transition-colors whitespace-nowrap"
                        >
                          <Eye size={10} /> View
                        </Link>
                        <Link
                          href={`/manager/clients/${entry.clientId}/packages/new`}
                          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-[#B9E84A] text-[#171917] text-[11px] font-semibold hover:bg-[#A8D63A] transition-colors whitespace-nowrap"
                        >
                          <RefreshCw size={10} /> Renew
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-[#6B6E67]">
                      No packages in this category
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

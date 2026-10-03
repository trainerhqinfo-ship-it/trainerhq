import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { formatDate, formatTime } from "@/lib/utils";

const STATUSES = ["scheduled", "completed", "cancelled", "no_show"];

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusFilter = "" } = await searchParams;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user.id).single();
  const gymId = profile?.gym_id;
  if (!gymId) redirect("/login");

  let query = supabase
    .from("pt_sessions")
    .select("*, trainers(first_name, last_name, profile_picture_url), pt_clients(first_name, last_name)")
    .eq("gym_id", gymId)
    .order("session_date", { ascending: false })
    .order("start_time", { ascending: true })
    .limit(100);

  if (statusFilter) query = (query as any).eq("status", statusFilter);

  const { data: sessionsRaw } = await query;
  const sessions = sessionsRaw ?? [];

  return (
    <div>
      <Header title="Sessions" subtitle={`${sessions.length} sessions${sessions.length === 100 ? " (showing latest 100)" : ""}`} />

      <div className="px-8 py-6 space-y-4">
        {/* Filter tabs */}
        <div className="flex gap-1">
          {[{ value: "", label: "All" }, ...STATUSES.map(s => ({ value: s, label: s.replace("_", " ").replace(/^\w/, c => c.toUpperCase()) }))].map(s => (
            <a
              key={s.value}
              href={`/manager/sessions${s.value ? `?status=${s.value}` : ""}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s.value || (!statusFilter && !s.value)
                  ? "bg-[#B9E84A] text-[#1A1C18]"
                  : "text-[#6B6E67] hover:bg-[#222520]"
              }`}
            >
              {s.label}
            </a>
          ))}
        </div>

        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-[#1A1C18]">
                {["Date", "Time", "Client", "Trainer", "Status", "Revenue", "Notes"].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-[11px] font-medium text-[#6B6E67]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((session: any) => {
                const trainer = session.trainers;
                const client = session.pt_clients;
                return (
                  <tr key={session.id} className="border-b border-[#1A1C18] table-row-hover">
                    <td className="px-5 py-3.5 text-sm text-[#E8EBE4] whitespace-nowrap">
                      {formatDate(session.session_date)}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[#6B6E67] tabular-nums whitespace-nowrap">
                      {formatTime(session.start_time)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Avatar firstName={client?.first_name ?? "?"} lastName={client?.last_name ?? ""} size="xs" />
                        <span className="text-sm text-[#E8EBE4]">{client?.first_name} {client?.last_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Avatar firstName={trainer?.first_name ?? "?"} lastName={trainer?.last_name ?? ""} src={trainer?.profile_picture_url} size="xs" />
                        <span className="text-sm text-[#E8EBE4]">{trainer?.first_name} {trainer?.last_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={session.status} /></td>
                    <td className="px-5 py-3.5 text-sm text-[#6B6E67]">
                      {session.session_revenue ? `₹${session.session_revenue.toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#6B6E67] max-w-[160px] truncate">
                      {session.notes ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!sessions.length && (
            <div className="py-16 text-center text-sm text-[#6B6E67]">No sessions found</div>
          )}
        </div>
      </div>
    </div>
  );
}

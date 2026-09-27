import { notFound, redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, formatTime, DAY_NAMES_FULL } from "@/lib/utils";
import Link from "next/link";
import { Edit, UserCheck } from "lucide-react";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user.id).single();
  const gymId = profile?.gym_id;
  if (!gymId) redirect("/login");

  const [
    { data: client },
    { data: assignment },
    { data: pkg },
    { data: sessionsRaw },
  ] = await Promise.all([
    supabase.from("pt_clients").select("*").eq("id", id).eq("gym_id", gymId).single(),
    supabase.from("pt_assignments").select("*, trainers(*)").eq("client_id", id).eq("status", "active").single(),
    supabase.from("pt_packages").select("*").eq("client_id", id).eq("is_active", true).single(),
    supabase.from("pt_sessions").select("*, trainers(first_name, last_name)").eq("client_id", id).order("session_date", { ascending: false }).limit(10),
  ]);

  if (!client) notFound();

  const sessions = sessionsRaw ?? [];
  const completed = sessions.filter((s: any) => s.status === "completed").length;
  const remaining = pkg ? pkg.total_sessions - completed : null;
  const trainer = (assignment as any)?.trainers;

  return (
    <div>
      <Header
        title={`${client.first_name} ${client.last_name}`}
        subtitle="PT Client"
        actions={
          <div className="flex gap-2">
            <Link
              href={`/manager/assignments/new?client=${id}`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#B9E84A] text-[#171917] text-xs font-medium hover:bg-[#A8D63A] transition-colors border border-[#A8D63A]"
            >
              <UserCheck size={12} /> Assign Trainer
            </Link>
            <Link
              href={`/manager/clients/${id}/edit`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#2E3129] text-xs font-medium text-[#E8EBE4] hover:bg-[#1A1C18] transition-colors"
            >
              <Edit size={12} /> Edit
            </Link>
          </div>
        }
      />

      <div className="px-8 py-6 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Profile */}
          <div className="lg:col-span-2 bg-[#222520] border border-[#2E3129] rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <Avatar firstName={client.first_name} lastName={client.last_name} size="lg" />
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-[#E8EBE4]">
                      {client.first_name} {client.last_name}
                    </h2>
                    <p className="text-sm text-[#9B9E96]">{client.phone}</p>
                  </div>
                  <StatusBadge status={client.status} />
                </div>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-[#9B9E96]">Goal</div>
                    <div className="font-medium text-[#E8EBE4] mt-0.5">{client.goal ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#9B9E96]">Joined</div>
                    <div className="font-medium text-[#E8EBE4] mt-0.5">{formatDate(client.joining_date)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#9B9E96]">PT Start</div>
                    <div className="font-medium text-[#E8EBE4] mt-0.5">
                      {client.pt_start_date ? formatDate(client.pt_start_date) : "—"}
                    </div>
                  </div>
                  {client.preferred_time && (
                    <div>
                      <div className="text-xs text-[#9B9E96]">Preferred Time</div>
                      <div className="font-medium text-[#E8EBE4] mt-0.5">{formatTime(client.preferred_time)}</div>
                    </div>
                  )}
                  {client.preferred_days?.length > 0 && (
                    <div className="col-span-2">
                      <div className="text-xs text-[#9B9E96]">Preferred Days</div>
                      <div className="font-medium text-[#E8EBE4] mt-0.5">
                        {client.preferred_days.map((d: number) => DAY_NAMES_FULL[d].slice(0, 3)).join(", ")}
                      </div>
                    </div>
                  )}
                </div>
                {client.notes && (
                  <p className="mt-3 text-xs text-[#9B9E96] bg-[#1A1C18] rounded-lg p-3 leading-relaxed">
                    {client.notes}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Package & Assignment */}
          <div className="space-y-4">
            {pkg && (
              <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5">
                <div className="text-xs text-[#9B9E96] mb-1">PT Package</div>
                <div className="font-semibold text-[#E8EBE4]">{pkg.package_name}</div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#9B9E96]">Progress</span>
                    <span className="font-medium text-[#E8EBE4]">{completed}/{pkg.total_sessions}</span>
                  </div>
                  <div className="h-2 bg-[#1A1C18] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#B9E84A] rounded-full"
                      style={{ width: `${Math.min(100, (completed / pkg.total_sessions) * 100)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-[#9B9E96] mt-1">{remaining} sessions remaining</div>
                </div>
                {pkg.package_value && (
                  <div className="mt-3 text-xs text-[#9B9E96]">
                    Package value: <span className="text-[#E8EBE4] font-medium">₹{pkg.package_value.toLocaleString("en-IN")}</span>
                  </div>
                )}
              </div>
            )}

            <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5">
              <div className="text-xs text-[#9B9E96] mb-3">Assigned Trainer</div>
              {trainer ? (
                <div className="flex items-center gap-2.5">
                  <Avatar firstName={trainer.first_name} lastName={trainer.last_name} size="sm" />
                  <div>
                    <div className="text-sm font-medium text-[#E8EBE4]">
                      {trainer.first_name} {trainer.last_name}
                    </div>
                    <div className="text-xs text-[#9B9E96]">
                      {(assignment as any)?.days_of_week?.map((d: number) => DAY_NAMES_FULL[d].slice(0, 3)).join(", ")}
                      {(assignment as any)?.preferred_time ? ` · ${formatTime((assignment as any).preferred_time)}` : ""}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[#9B9E96]">
                  No trainer assigned.{" "}
                  <Link href={`/manager/assignments/new?client=${id}`} className="text-[#E8EBE4] underline">
                    Assign now
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2E3129]">
            <h3 className="text-sm font-semibold text-[#E8EBE4]">Recent Sessions</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1A1C18]">
                {["Date", "Time", "Trainer", "Status"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-medium text-[#9B9E96]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((session: any) => {
                const tr = session.trainers;
                return (
                  <tr key={session.id} className="border-b border-[#1A1C18] last:border-0">
                    <td className="px-5 py-3 text-sm text-[#E8EBE4]">{formatDate(session.session_date)}</td>
                    <td className="px-5 py-3 text-sm text-[#9B9E96]">{formatTime(session.start_time)}</td>
                    <td className="px-5 py-3 text-sm text-[#E8EBE4]">{tr?.first_name} {tr?.last_name}</td>
                    <td className="px-5 py-3"><StatusBadge status={session.status} /></td>
                  </tr>
                );
              })}
              {!sessions.length && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-[#9B9E96]">No sessions yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

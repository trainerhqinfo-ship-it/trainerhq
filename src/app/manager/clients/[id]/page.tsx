import { notFound, redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, formatTime, DAY_NAMES_FULL } from "@/lib/utils";
import Link from "next/link";
import { Edit, UserCheck, RefreshCw, Star, ExternalLink, FileText } from "lucide-react";

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
    { data: feedbackRaw },
  ] = await Promise.all([
    supabase.from("pt_clients").select("*").eq("id", id).eq("gym_id", gymId).single(),
    supabase.from("pt_assignments").select("*, trainers(*)").eq("client_id", id).eq("gym_id", gymId).eq("status", "active").maybeSingle(),
    supabase.from("pt_packages").select("*").eq("client_id", id).eq("gym_id", gymId).eq("is_active", true).maybeSingle(),
    supabase.from("pt_sessions").select("*, trainers(first_name, last_name)").eq("client_id", id).eq("gym_id", gymId).order("session_date", { ascending: false }).limit(20),
    supabase.from("trainer_feedback").select("*").eq("client_id", id).eq("gym_id", gymId).order("created_at", { ascending: false }).limit(5),
  ]);

  if (!client) notFound();

  let billSignedUrl: string | null = null;
  if ((pkg as any)?.bill_url) {
    const { data: signedData } = await supabase.storage
      .from("pt-bills")
      .createSignedUrl((pkg as any).bill_url, 60 * 60);
    billSignedUrl = signedData?.signedUrl ?? null;
  }

  const sessions = sessionsRaw ?? [];
  const feedback = feedbackRaw ?? [];
  const completed = sessions.filter((s: any) => s.status === "completed").length;
  const remaining = pkg ? Math.max(0, pkg.total_sessions - completed) : (assignment as any)?.total_sessions ? Math.max(0, (assignment as any).total_sessions - completed) : null;
  const trainer = (assignment as any)?.trainers;
  const avgRating = feedback.length > 0
    ? (feedback.reduce((s: number, f: any) => s + (f.overall_rating ?? 0), 0) / feedback.length).toFixed(1)
    : null;

  return (
    <div>
      <Header
        title={`${client.first_name} ${client.last_name}`}
        subtitle="PT Client"
        actions={
          <div className="flex gap-2">
            {assignment ? (
              <Link
                href={`/manager/assignments/${(assignment as any).id}/reassign`}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-orange-500/10 border border-orange-500/30 text-xs font-medium text-orange-400 hover:bg-orange-500/20 transition-colors"
              >
                <RefreshCw size={12} /> Reassign Trainer
              </Link>
            ) : (
              <Link
                href={`/manager/assignments/new?client=${id}`}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#B9E84A] text-[#171917] text-xs font-medium hover:bg-[#A8D63A] transition-colors"
              >
                <UserCheck size={12} /> Assign Trainer
              </Link>
            )}
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
                <div className="mt-4 pt-4 border-t border-[#1A1C18]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-[#9B9E96]">Notes</span>
                    <Link href={`/manager/clients/${id}/edit`} className="text-[10px] text-[#6B6E67] hover:text-[#E8EBE4]">Edit notes →</Link>
                  </div>
                  {client.notes ? (
                    <p className="text-xs text-[#9B9E96] bg-[#1A1C18] rounded-lg p-3 leading-relaxed">{client.notes}</p>
                  ) : (
                    <p className="text-xs text-[#6B6E67] italic">No notes yet — add via Edit</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Package & Assignment */}
          <div className="space-y-4">
            {pkg && (
              <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5 space-y-3">
                <div>
                  <div className="text-xs text-[#9B9E96] mb-0.5">PT Package</div>
                  <div className="font-semibold text-[#E8EBE4]">{pkg.package_name ?? "—"}</div>
                </div>

                {/* Sessions progress */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#9B9E96]">Sessions</span>
                    <span className="font-medium text-[#E8EBE4]">{completed}/{pkg.total_sessions}</span>
                  </div>
                  <div className="h-2 bg-[#1A1C18] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#B9E84A] rounded-full"
                      style={{ width: `${pkg.total_sessions > 0 ? Math.min(100, (completed / pkg.total_sessions) * 100) : 0}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-[#9B9E96] mt-1">{remaining} remaining</div>
                </div>

                {/* Financials */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#1A1C18]">
                  {(pkg as any).package_value != null && (
                    <div>
                      <div className="text-[10px] text-[#9B9E96]">Package Value</div>
                      <div className="text-sm font-medium text-[#E8EBE4]">₹{(pkg as any).package_value.toLocaleString("en-IN")}</div>
                    </div>
                  )}
                  {(pkg as any).amount_collected != null && (
                    <div>
                      <div className="text-[10px] text-[#9B9E96]">Amount Collected</div>
                      <div className="text-sm font-semibold text-[#B9E84A]">₹{(pkg as any).amount_collected.toLocaleString("en-IN")}</div>
                    </div>
                  )}
                </div>

                {/* Invoice & Bill */}
                {((pkg as any).invoice_number || billSignedUrl) && (
                  <div className="space-y-1.5 pt-2 border-t border-[#1A1C18]">
                    {(pkg as any).invoice_number && (
                      <div className="flex items-center gap-1.5 text-xs text-[#9B9E96]">
                        <span className="text-[#6B6E67]">Invoice:</span>
                        <span className="font-medium text-[#E8EBE4]">{(pkg as any).invoice_number}</span>
                      </div>
                    )}
                    {billSignedUrl && (
                      <a
                        href={billSignedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[#B9E84A] hover:underline"
                      >
                        <FileText size={11} />
                        View Bill
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5">
              <div className="text-xs text-[#9B9E96] mb-3">Assigned Trainer</div>
              {trainer ? (
                <Link
                  href={`/manager/trainers/${(assignment as any).trainer_id}`}
                  className="flex items-center gap-2.5 group"
                >
                  <Avatar firstName={trainer.first_name} lastName={trainer.last_name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#E8EBE4] group-hover:text-[#B9E84A] transition-colors">
                      {trainer.first_name} {trainer.last_name}
                    </div>
                    <div className="text-xs text-[#9B9E96]">
                      {(assignment as any)?.days_of_week?.map((d: number) => DAY_NAMES_FULL[d].slice(0, 3)).join(", ")}
                      {(assignment as any)?.preferred_time ? ` · ${formatTime((assignment as any).preferred_time)}` : ""}
                    </div>
                  </div>
                  <span className="text-[10px] text-[#B9E84A] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    View →
                  </span>
                </Link>
              ) : (
                <div className="space-y-1">
                  <div className="text-sm text-[#6B6E67]">Unassigned</div>
                  <Link
                    href={`/manager/assignments/new?client=${id}`}
                    className="text-xs text-[#B9E84A] hover:underline"
                  >
                    Assign Trainer →
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

        {/* Client Feedback */}
        {feedback.length > 0 && (
          <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2E3129] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#E8EBE4]">Client Feedback</h3>
              {avgRating && (
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(n => (
                      <Star key={n} size={11} className={n <= Math.round(Number(avgRating)) ? "text-amber-400 fill-amber-400" : "text-[#2E3129] fill-[#2E3129]"} />
                    ))}
                  </div>
                  <span className="text-xs text-[#9B9E96]">{avgRating} avg</span>
                </div>
              )}
            </div>
            <div className="divide-y divide-[#1A1C18]">
              {feedback.map((f: any) => (
                <div key={f.id} className="px-5 py-4">
                  <div className="flex items-center gap-1 mb-1.5">
                    {[1,2,3,4,5].map(n => (
                      <Star key={n} size={11} className={n <= (f.overall_rating ?? 0) ? "text-amber-400 fill-amber-400" : "text-[#2E3129] fill-[#2E3129]"} />
                    ))}
                  </div>
                  <div className="flex gap-3 text-[10px] text-[#9B9E96] mb-1.5">
                    {f.is_punctual !== null && <span>{f.is_punctual ? "✓ Punctual" : "✗ Not punctual"}</span>}
                    {f.satisfied_with_progress !== null && <span>{f.satisfied_with_progress ? "✓ Progress" : "✗ No progress"}</span>}
                    {f.would_continue !== null && <span>{f.would_continue ? "✓ Would continue" : "✗ Would not continue"}</span>}
                  </div>
                  {f.written_feedback && (
                    <p className="text-xs text-[#9B9E96] italic">&quot;{f.written_feedback}&quot;</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

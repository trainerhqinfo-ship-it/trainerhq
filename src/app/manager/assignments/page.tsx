import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { formatDate, formatTime, DAY_NAMES_FULL } from "@/lib/utils";
import { Plus } from "lucide-react";
import Link from "next/link";

export default async function AssignmentsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user.id).single();
  const gymId = profile?.gym_id;
  if (!gymId) redirect("/login");

  const { data: assignmentsRaw } = await supabase
    .from("pt_assignments")
    .select("*, pt_clients(first_name, last_name, goal), trainers(first_name, last_name, profile_picture_url)")
    .eq("gym_id", gymId)
    .eq("status", "active")
    .order("start_date", { ascending: false });

  const assignments = assignmentsRaw ?? [];

  return (
    <div>
      <Header
        title="Assignments"
        subtitle={`${assignments.length} active assignments`}
        actions={
          <Link
            href="/manager/assignments/new"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#B9E84A] text-[#171917] text-xs font-medium hover:bg-[#A8D63A] transition-colors border border-[#A8D63A]"
          >
            <Plus size={13} /> New Assignment
          </Link>
        }
      />

      <div className="px-8 py-6">
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-[#1A1C18]">
                {["Client", "Trainer", "Schedule", "Start Date", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-[11px] font-medium text-[#6B6E67]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assignments.map((a: any) => {
                const client = a.pt_clients;
                const trainer = a.trainers;
                return (
                  <tr key={a.id} className="border-b border-[#1A1C18] table-row-hover">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar firstName={client?.first_name ?? "?"} lastName={client?.last_name ?? ""} size="sm" />
                        <div>
                          <div className="text-sm font-medium text-[#E8EBE4]">{client?.first_name} {client?.last_name}</div>
                          <div className="text-xs text-[#6B6E67]">{client?.goal}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Avatar firstName={trainer?.first_name ?? "?"} lastName={trainer?.last_name ?? ""} src={trainer?.profile_picture_url} size="xs" />
                        <span className="text-sm text-[#E8EBE4]">{trainer?.first_name} {trainer?.last_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-sm text-[#E8EBE4]">
                        {!a.days_of_week || a.days_of_week.length === 0
                          ? "All days"
                          : a.days_of_week.map((d: number) => DAY_NAMES_FULL[d].slice(0, 3)).join(", ")}
                      </div>
                      <div className="text-xs text-[#6B6E67]">{formatTime(a.preferred_time)}</div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[#6B6E67]">{formatDate(a.start_date)}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={a.status} /></td>
                    <td className="px-5 py-3.5">
                      <Link href={`/manager/assignments/${a.id}/reassign`} className="text-xs text-[#6B6E67] hover:text-[#E8EBE4]">
                        Reassign →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!assignments.length && (
            <div className="py-16 text-center text-sm text-[#6B6E67]">
              No assignments yet.{" "}
              <Link href="/manager/assignments/new" className="underline text-[#E8EBE4]">Create one</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

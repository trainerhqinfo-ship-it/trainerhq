"use client";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { formatDate, formatTime } from "@/lib/utils";
import { SessionActions } from "./session-actions";

interface Props {
  sessions: any[];
  trainerId: string;
}

export function SessionsTable({ sessions, trainerId }: Props) {
  const router = useRouter();

  return (
    <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden overflow-x-auto">
      <table className="w-full min-w-[500px]">
        <thead>
          <tr className="border-b border-[#1A1C18]">
            {["Date", "Time", "Client", "Status", "Notes", ""].map(h => (
              <th key={h} className="text-left px-5 py-3.5 text-[11px] font-medium text-[#6B6E67]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sessions.map((s: any) => {
            const client = s.pt_clients;
            return (
              <tr key={s.id} className="border-b border-[#1A1C18] last:border-b-0">
                <td className="px-5 py-3.5 text-sm text-[#E8EBE4]">{formatDate(s.session_date)}</td>
                <td className="px-5 py-3.5 text-sm text-[#6B6E67] tabular-nums">{formatTime(s.start_time)}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <Avatar firstName={client?.first_name ?? "?"} lastName={client?.last_name ?? ""} size="xs" />
                    <span className="text-sm text-[#E8EBE4]">{client?.first_name} {client?.last_name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5"><StatusBadge status={s.status} /></td>
                <td className="px-5 py-3.5 text-xs text-[#6B6E67] max-w-[160px] truncate">{s.notes ?? "—"}</td>
                <td className="px-5 py-3.5">
                  {s.status === "scheduled" && (
                    <SessionActions
                      sessionId={s.id}
                      currentNotes={s.notes ?? ""}
                      trainerId={trainerId}
                      onDone={() => router.refresh()}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!sessions.length && (
        <div className="py-12 text-center text-sm text-[#6B6E67]">No sessions yet</div>
      )}
    </div>
  );
}

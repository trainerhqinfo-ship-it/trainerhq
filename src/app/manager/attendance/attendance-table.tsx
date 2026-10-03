"use client";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { AttendanceActions, AttendanceRowActions, type AttendanceRecord as BaseAttendanceRecord } from "./attendance-actions";

interface Trainer {
  id: string;
  first_name: string;
  last_name: string;
  profile_picture_url?: string | null;
  status: string;
}

interface AttendanceRecord extends BaseAttendanceRecord {
  source?: string;
  trainers?: { first_name?: string; last_name?: string; profile_picture_url?: string | null };
}

interface Props {
  trainers: Trainer[];
  attendance: AttendanceRecord[];
  filterTrainer: string;
  rangeFrom: string;
  rangeTo: string;
  gymId: string;
  userId: string;
}

function fmt12(t: string | null) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function sourceBadge(source: string) {
  const map: Record<string, { label: string; cls: string }> = {
    manual: { label: "Manual", cls: "bg-[#2E3129] text-[#9B9E96]" },
    google_sheets: { label: "Sheets", cls: "bg-blue-500/10 text-blue-400" },
    api: { label: "API", cls: "bg-purple-500/10 text-purple-400" },
  };
  const b = map[source] ?? map.manual;
  return (
    <span className={`px-2 py-0.5 rounded text-[9px] font-semibold uppercase ${b.cls}`}>
      {b.label}
    </span>
  );
}

export function AttendanceTable({
  trainers,
  attendance,
  filterTrainer,
  rangeFrom,
  rangeTo,
  gymId,
  userId,
}: Props) {
  const [editTarget, setEditTarget] = useState<AttendanceRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AttendanceRecord | null>(null);

  return (
    <>
      <AttendanceActions
        trainers={trainers}
        filterTrainer={filterTrainer}
        rangeFrom={rangeFrom}
        rangeTo={rangeTo}
        gymId={gymId}
        userId={userId}
        editRecord={editTarget}
        deleteRecord={deleteTarget}
        onCloseEdit={() => setEditTarget(null)}
        onCloseDelete={() => setDeleteTarget(null)}
      />

      {attendance.length === 0 ? (
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl py-16 text-center">
          <p className="text-sm text-[#6B6E67]">No attendance records for this period</p>
          <p className="text-xs text-[#4A4D47] mt-1">Add records manually or sync from Google Sheets</p>
        </div>
      ) : (
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-[#1A1C18]">
                  {["Trainer", "Date", "Check In", "Check Out", "Duration", "Source", "Notes", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B6E67] uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1C18]">
                {attendance.map((rec) => {
                  const trainer = rec.trainers ?? {};
                  let duration = "—";
                  if (rec.check_in_time && rec.check_out_time) {
                    const [ih, im] = rec.check_in_time.split(":").map(Number);
                    const [oh, om] = rec.check_out_time.split(":").map(Number);
                    const mins = oh * 60 + om - (ih * 60 + im);
                    if (mins > 0) {
                      const hh = Math.floor(mins / 60);
                      const mm = mins % 60;
                      duration = hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
                    }
                  }

                  return (
                    <tr key={rec.id} className="hover:bg-[#1A1C18]/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar
                            firstName={(trainer as any).first_name ?? "?"}
                            lastName={(trainer as any).last_name ?? ""}
                            src={(trainer as any).profile_picture_url ?? null}
                            size="xs"
                          />
                          <span className="text-xs font-medium text-[#E8EBE4] truncate max-w-[110px]">
                            {(trainer as any).first_name} {(trainer as any).last_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#E8EBE4]">
                        {new Date(rec.attendance_date + "T00:00:00").toLocaleDateString("en-IN", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#E8EBE4] tabular-nums">{fmt12(rec.check_in_time)}</td>
                      <td className="px-4 py-3 text-xs text-[#9B9E96] tabular-nums">{fmt12(rec.check_out_time)}</td>
                      <td className="px-4 py-3 text-xs text-[#9B9E96] tabular-nums">{duration}</td>
                      <td className="px-4 py-3">{sourceBadge(rec.source ?? "manual")}</td>
                      <td className="px-4 py-3 text-xs text-[#6B6E67] max-w-[120px] truncate">{rec.notes ?? "—"}</td>
                      <td className="px-4 py-3">
                        <AttendanceRowActions
                          record={rec}
                          onEdit={(r) => setEditTarget(r)}
                          onDelete={(r) => setDeleteTarget(r)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

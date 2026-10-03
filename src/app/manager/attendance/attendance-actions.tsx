"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Dialog } from "@/components/ui/dialog";
import { Plus, Loader2, Edit2, Trash2, AlertTriangle } from "lucide-react";

interface Trainer {
  id: string;
  first_name: string;
  last_name: string;
  profile_picture_url?: string | null;
  status: string;
}

export interface AttendanceRecord {
  id: string;
  trainer_id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  notes: string | null;
  source?: string;
}

interface Props {
  trainers: Trainer[];
  filterTrainer: string;
  rangeFrom: string;
  rangeTo: string;
  gymId: string;
  userId: string;
  // Controlled from AttendanceTable for row-level actions
  editRecord?: AttendanceRecord | null;
  deleteRecord?: AttendanceRecord | null;
  onCloseEdit?: () => void;
  onCloseDelete?: () => void;
}

const emptyForm = {
  trainer_id: "",
  attendance_date: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
  check_in_time: "07:00",
  check_out_time: "",
  notes: "",
};

export function AttendanceActions({
  trainers,
  filterTrainer,
  rangeFrom,
  rangeTo,
  gymId,
  userId,
  editRecord,
  deleteRecord,
  onCloseEdit,
  onCloseDelete,
}: Props) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);

  // Sync form when editRecord changes
  useEffect(() => {
    if (editRecord) {
      setForm({
        trainer_id: editRecord.trainer_id,
        attendance_date: editRecord.attendance_date,
        check_in_time: editRecord.check_in_time ?? "",
        check_out_time: editRecord.check_out_time ?? "",
        notes: editRecord.notes ?? "",
      });
      setError("");
    }
  }, [editRecord]);

  function buildUrl(params: Record<string, string>) {
    const p = new URLSearchParams();
    if (params.trainer_id) p.set("trainer_id", params.trainer_id);
    if (params.from) p.set("from", params.from);
    if (params.to) p.set("to", params.to);
    return `/manager/attendance?${p.toString()}`;
  }

  async function handleSave() {
    if (!form.trainer_id) { setError("Select a trainer."); return; }
    if (!form.attendance_date) { setError("Date is required."); return; }
    setSaving(true);
    setError("");

    try {
      const supabase = createClient();

      if (editRecord) {
        const { error: err } = await supabase
          .from("trainer_attendance" as any)
          .update({
            check_in_time: form.check_in_time || null,
            check_out_time: form.check_out_time || null,
            notes: form.notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editRecord.id)
          .eq("gym_id", gymId);

        if (err) throw err;

        await supabase.from("audit_logs").insert({
          gym_id: gymId,
          user_id: userId,
          action: "attendance_updated",
          entity_type: "trainer_attendance",
          entity_id: editRecord.id,
          old_values: {
            check_in_time: editRecord.check_in_time,
            check_out_time: editRecord.check_out_time,
          },
          new_values: {
            check_in_time: form.check_in_time || null,
            check_out_time: form.check_out_time || null,
          },
        });

        onCloseEdit?.();
      } else {
        const { error: err } = await supabase.from("trainer_attendance" as any).upsert(
          {
            gym_id: gymId,
            trainer_id: form.trainer_id,
            attendance_date: form.attendance_date,
            check_in_time: form.check_in_time || null,
            check_out_time: form.check_out_time || null,
            notes: form.notes || null,
            source: "manual",
          },
          { onConflict: "gym_id,trainer_id,attendance_date" }
        );

        if (err) throw err;

        await supabase.from("audit_logs").insert({
          gym_id: gymId,
          user_id: userId,
          action: "attendance_marked",
          entity_type: "trainer_attendance",
          new_values: {
            trainer_id: form.trainer_id,
            attendance_date: form.attendance_date,
            check_in_time: form.check_in_time || null,
          },
        });

        setShowAdd(false);
        setForm(emptyForm);
      }

      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Failed to save.");
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteRecord) return;
    setDeleting(true);

    try {
      const supabase = createClient();
      const { error: err } = await supabase
        .from("trainer_attendance" as any)
        .delete()
        .eq("id", deleteRecord.id)
        .eq("gym_id", gymId);

      if (err) throw err;

      await supabase.from("audit_logs").insert({
        gym_id: gymId,
        user_id: userId,
        action: "attendance_deleted",
        entity_type: "trainer_attendance",
        entity_id: deleteRecord.id,
        old_values: {
          trainer_id: deleteRecord.trainer_id,
          attendance_date: deleteRecord.attendance_date,
          check_in_time: deleteRecord.check_in_time,
          check_out_time: deleteRecord.check_out_time,
        },
      });

      onCloseDelete?.();
      setDeleting(false);
      router.refresh();
    } catch (e: any) {
      setError(e.message ?? "Failed to delete.");
      setDeleting(false);
    }
  }

  const t = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const isEditing = !!editRecord;
  const showForm = showAdd || isEditing;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterTrainer}
          onChange={(e) =>
            router.push(buildUrl({ trainer_id: e.target.value, from: rangeFrom, to: rangeTo }))
          }
          className="h-9 px-3 text-xs bg-[#222520] border border-[#2E3129] rounded-xl text-[#E8EBE4] focus:outline-none focus:border-[#B9E84A] cursor-pointer"
        >
          <option value="">All Trainers</option>
          {trainers.map((tr) => (
            <option key={tr.id} value={tr.id}>
              {tr.first_name} {tr.last_name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5 bg-[#222520] border border-[#2E3129] rounded-xl px-3 h-9">
          <input
            type="date"
            value={rangeFrom}
            onChange={(e) =>
              router.push(buildUrl({ trainer_id: filterTrainer, from: e.target.value, to: rangeTo }))
            }
            className="bg-transparent text-xs text-[#E8EBE4] focus:outline-none w-28"
          />
          <span className="text-[#4A4D47] text-xs">—</span>
          <input
            type="date"
            value={rangeTo}
            onChange={(e) =>
              router.push(buildUrl({ trainer_id: filterTrainer, from: rangeFrom, to: e.target.value }))
            }
            className="bg-transparent text-xs text-[#E8EBE4] focus:outline-none w-28"
          />
        </div>

        <div className="flex-1" />

        <button
          onClick={() => { setForm(emptyForm); setError(""); setShowAdd(true); }}
          className="inline-flex items-center gap-1.5 h-9 px-4 bg-[#B9E84A] text-[#171917] text-xs font-semibold rounded-xl hover:bg-[#A8D63A] transition-colors"
        >
          <Plus size={12} /> Mark Attendance
        </button>
      </div>

      {/* Add / Edit dialog */}
      <Dialog
        open={showForm}
        onClose={() => { setShowAdd(false); onCloseEdit?.(); setError(""); }}
        title={isEditing ? "Edit Attendance" : "Mark Attendance"}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-[#E8EBE4] mb-1.5 block">Trainer *</label>
            <select
              value={form.trainer_id}
              onChange={(e) => t("trainer_id", e.target.value)}
              disabled={isEditing}
              className="w-full px-3 py-2.5 text-sm bg-[#1A1C18] border border-[#2E3129] rounded-xl text-[#E8EBE4] focus:outline-none focus:border-[#B9E84A] disabled:opacity-60"
            >
              <option value="">Select trainer…</option>
              {trainers.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.first_name} {tr.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-[#E8EBE4] mb-1.5 block">Date *</label>
            <input
              type="date"
              value={form.attendance_date}
              onChange={(e) => t("attendance_date", e.target.value)}
              disabled={isEditing}
              className="w-full px-3 py-2.5 text-sm bg-[#1A1C18] border border-[#2E3129] rounded-xl text-[#E8EBE4] focus:outline-none focus:border-[#B9E84A] disabled:opacity-60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#E8EBE4] mb-1.5 block">Check In</label>
              <input
                type="time"
                value={form.check_in_time}
                onChange={(e) => t("check_in_time", e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-[#1A1C18] border border-[#2E3129] rounded-xl text-[#E8EBE4] focus:outline-none focus:border-[#B9E84A]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#E8EBE4] mb-1.5 block">Check Out</label>
              <input
                type="time"
                value={form.check_out_time}
                onChange={(e) => t("check_out_time", e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-[#1A1C18] border border-[#2E3129] rounded-xl text-[#E8EBE4] focus:outline-none focus:border-[#B9E84A]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[#E8EBE4] mb-1.5 block">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => t("notes", e.target.value)}
              placeholder="Optional notes…"
              className="w-full px-3 py-2.5 text-sm bg-[#1A1C18] border border-[#2E3129] rounded-xl text-[#E8EBE4] placeholder-[#4A4D47] focus:outline-none focus:border-[#B9E84A]"
            />
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setShowAdd(false); onCloseEdit?.(); setError(""); }}
              className="flex-1 h-10 rounded-xl border border-[#2E3129] text-sm text-[#9B9E96] hover:bg-[#1A1C18] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-10 rounded-xl bg-[#B9E84A] text-[#171917] text-sm font-semibold hover:bg-[#A8D63A] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {saving ? "Saving…" : isEditing ? "Update" : "Save"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteRecord}
        onClose={() => { onCloseDelete?.(); setError(""); }}
        title="Delete Attendance Record"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 px-3 py-3 bg-red-500/10 border border-red-500/30 rounded-xl">
            <AlertTriangle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-red-400">
              Permanently delete the attendance record for{" "}
              <strong>
                {trainers.find((t) => t.id === deleteRecord?.trainer_id)?.first_name ?? ""}
              </strong>{" "}
              on <strong>{deleteRecord?.attendance_date}</strong>? This cannot be undone.
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { onCloseDelete?.(); setError(""); }}
              className="flex-1 h-10 rounded-xl border border-[#2E3129] text-sm text-[#9B9E96] hover:bg-[#1A1C18] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : null}
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

// Row-level edit/delete buttons rendered inside table rows
export function AttendanceRowActions({
  record,
  onEdit,
  onDelete,
}: {
  record: AttendanceRecord;
  onEdit: (rec: AttendanceRecord) => void;
  onDelete: (rec: AttendanceRecord) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onEdit(record)}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B6E67] hover:text-[#E8EBE4] hover:bg-[#2E3129] transition-colors"
        title="Edit"
      >
        <Edit2 size={12} />
      </button>
      <button
        onClick={() => onDelete(record)}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6B6E67] hover:text-red-400 hover:bg-red-500/10 transition-colors"
        title="Delete"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

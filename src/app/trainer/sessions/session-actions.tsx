"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CheckSquare, X, Ban, UserX, Calendar } from "lucide-react";

interface SessionActionsProps {
  sessionId: string;
  currentNotes: string;
  trainerId: string;
  onDone: () => void;
}

type NewStatus = "completed" | "cancelled" | "no_show";

export function SessionActions({ sessionId, currentNotes, trainerId, onDone }: SessionActionsProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(currentNotes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAction = async (newStatus: NewStatus) => {
    setLoading(true);
    setError("");
    const supabase = createClient();

    // Re-verify ownership and current status before updating
    const { data: session } = await supabase
      .from("pt_sessions")
      .select("status, trainer_id, gym_id")
      .eq("id", sessionId)
      .single();

    if (!session) { setError("Session not found."); setLoading(false); return; }
    if (session.trainer_id !== trainerId) { setError("You can only update your own sessions."); setLoading(false); return; }
    if (session.status !== "scheduled") { setError("This session has already been actioned."); setLoading(false); return; }

    const updateData: Record<string, any> = {
      status: newStatus,
      notes: notes || null,
    };
    if (newStatus === "completed") {
      updateData.completed_at = new Date().toISOString();
    }

    const { error: updateErr } = await supabase
      .from("pt_sessions")
      .update(updateData)
      .eq("id", sessionId)
      .eq("trainer_id", trainerId)
      .eq("status", "scheduled"); // extra guard: only update if still scheduled

    if (updateErr) { setError(updateErr.message); setLoading(false); return; }

    // Audit log
    await supabase.from("audit_logs").insert({
      gym_id: session.gym_id,
      action: `session_${newStatus}`,
      entity_type: "pt_session",
      entity_id: sessionId,
      new_values: { status: newStatus, notes: notes || null },
    }).then(() => {}); // non-blocking

    setOpen(false);
    setLoading(false);
    onDone(); // tell parent to re-fetch
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-medium text-[#B9E84A] bg-[#E8EBE4] px-3 py-1.5 rounded-lg hover:bg-[#1e2019] transition-colors"
      >
        <CheckSquare size={12} />
        Action
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => !loading && setOpen(false)}>
      <div className="bg-[#222520] rounded-2xl shadow-xl p-5 w-[320px]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[#E8EBE4]">Session Action</h3>
          <button onClick={() => setOpen(false)} disabled={loading}>
            <X size={14} className="text-[#6B6E67]" />
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-[#6B6E67] mb-1.5">Session Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Upper body, cardio, flexibility..."
            className="w-full border border-[#2E3129] rounded-xl px-3 py-2 text-sm text-[#E8EBE4] resize-none outline-none focus:border-[#B9E84A] transition-colors"
            rows={3}
            disabled={loading}
          />
        </div>

        {error && (
          <div className="mb-3 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => handleAction("completed")}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-[#E8EBE4] text-[#B9E84A] text-xs font-semibold py-2.5 rounded-xl hover:bg-[#1e2019] transition-colors disabled:opacity-60"
          >
            <CheckSquare size={13} />
            {loading ? "Saving..." : "Mark Completed"}
          </button>
          <button
            onClick={() => handleAction("cancelled")}
            disabled={loading}
            className="flex items-center justify-center gap-2 border border-orange-500/30 text-orange-400 bg-orange-500/10 text-xs font-medium py-2.5 rounded-xl hover:bg-orange-500/20 transition-colors disabled:opacity-60"
          >
            <Ban size={13} />
            Mark Cancelled
          </button>
          <button
            onClick={() => handleAction("no_show")}
            disabled={loading}
            className="flex items-center justify-center gap-2 border border-red-500/30 text-red-400 bg-red-500/10 text-xs font-medium py-2.5 rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-60"
          >
            <UserX size={13} />
            Mark No-show
          </button>
        </div>
      </div>
    </div>
  );
}
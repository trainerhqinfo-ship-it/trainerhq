"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Drawer } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { formatTime, DAY_NAMES } from "@/lib/utils";
import {
  Calendar, Clock, ExternalLink, Plus, UserCircle,
  RefreshCw, X, AlertTriangle, Loader2, CheckCircle,
} from "lucide-react";
import type { ClientSlotInfo } from "@/components/schedule/schedule-grid";

interface TrainerInfo {
  id: string;
  first_name: string;
  last_name: string;
  profile_picture_url?: string | null;
  max_clients_per_slot: number;
}

interface SlotDetailDrawerProps {
  trainer: TrainerInfo;
  date: string;
  time: string;
  clients: ClientSlotInfo[];
  gymId: string;
  userId: string;
  onClose: () => void;
  onAssignMore: () => void;
}

interface PackageInfo {
  package_name: string | null;
  total_sessions: number;
  sessions_completed: number;
}

type Mode = "view" | "reassign" | "cancel";

export function SlotDetailDrawer({
  trainer,
  date,
  time,
  clients,
  gymId,
  userId,
  onClose,
  onAssignMore,
}: SlotDetailDrawerProps) {
  const router = useRouter();
  const isFull = clients.length >= trainer.max_clients_per_slot;
  const hasCapacity = clients.length < trainer.max_clients_per_slot;

  const [mode, setMode] = useState<Mode>("view");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [packages, setPackages] = useState<Record<string, PackageInfo>>({});
  const [availableTrainers, setAvailableTrainers] = useState<any[]>([]);
  const [newTrainerId, setNewTrainerId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Lazy-load package/session info for visible clients
  useEffect(() => {
    const clientIds = clients.map((c) => c.id).filter(Boolean);
    if (clientIds.length === 0) return;

    const supabase = createClient();
    Promise.all(
      clientIds.map(async (cid) => {
        const [{ data: pkg }, { count }] = await Promise.all([
          supabase
            .from("pt_packages")
            .select("package_name, total_sessions")
            .eq("client_id", cid)
            .eq("gym_id", gymId)
            .eq("is_active", true)
            .maybeSingle(),
          supabase
            .from("pt_sessions")
            .select("id", { count: "exact", head: true })
            .eq("client_id", cid)
            .eq("gym_id", gymId)
            .eq("status", "completed"),
        ]);
        return {
          clientId: cid,
          info: {
            package_name: pkg?.package_name ?? null,
            total_sessions: pkg?.total_sessions ?? 0,
            sessions_completed: count ?? 0,
          } as PackageInfo,
        };
      })
    ).then((results) => {
      const map: Record<string, PackageInfo> = {};
      results.forEach(({ clientId, info }) => { map[clientId] = info; });
      setPackages(map);
    });
  }, [clients, gymId]);

  // Load available trainers for reassign mode
  useEffect(() => {
    if (mode !== "reassign") return;
    const supabase = createClient();
    supabase
      .from("trainers")
      .select("id, first_name, last_name, profile_picture_url, max_clients_per_slot, trainer_working_hours(*)")
      .eq("gym_id", gymId)
      .eq("status", "active")
      .then(({ data }) => {
        // Exclude current trainer
        setAvailableTrainers((data ?? []).filter((t: any) => t.id !== trainer.id));
      });
  }, [mode, gymId, trainer.id]);

  async function handleReassign() {
    if (!newTrainerId || !selectedClientId) return;
    const client = clients.find((c) => c.id === selectedClientId);
    if (!client?.assignment_id) { setError("No assignment found for this client."); return; }

    setSaving(true);
    setError("");
    try {
      const supabase = createClient();

      // Check target trainer capacity, filtering by days_of_week overlap
      // (same logic as schedule grid — empty days_of_week means all days)
      const targetTrainer = availableTrainers.find((t) => t.id === newTrainerId);
      if (targetTrainer) {
        const slotHour = parseInt(time.split(":")[0]);
        const { data: slotAssignments } = await supabase
          .from("pt_assignments")
          .select("id, days_of_week")
          .eq("trainer_id", newTrainerId)
          .eq("status", "active")
          .filter("preferred_time", "like", `${String(slotHour).padStart(2, "0")}%`);

        const movingDays: number[] =
          client.days_of_week && client.days_of_week.length > 0
            ? client.days_of_week
            : [0, 1, 2, 3, 4, 5, 6];

        const overlappingCount = (slotAssignments ?? []).filter((a: any) => {
          const aDays = a.days_of_week as number[] | null;
          if (!aDays || aDays.length === 0) return true;
          return movingDays.some((d: number) => aDays.includes(d));
        }).length;

        if (overlappingCount >= targetTrainer.max_clients_per_slot) {
          setError(`${targetTrainer.first_name} is at full capacity for this time slot.`);
          setSaving(false);
          return;
        }
      }

      const { data: oldAssign } = await supabase
        .from("pt_assignments")
        .select("*")
        .eq("id", client.assignment_id)
        .single();

      const { error: updateErr } = await supabase
        .from("pt_assignments")
        .update({ trainer_id: newTrainerId })
        .eq("id", client.assignment_id)
        .eq("gym_id", gymId);

      if (updateErr) throw updateErr;

      await supabase.from("audit_logs").insert({
        gym_id: gymId,
        user_id: userId,
        action: "assignment_reassigned",
        entity_type: "pt_assignment",
        entity_id: client.assignment_id,
        old_values: { trainer_id: oldAssign?.trainer_id },
        new_values: { trainer_id: newTrainerId },
      });

      router.refresh();
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Reassign failed.");
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!selectedClientId) return;
    const client = clients.find((c) => c.id === selectedClientId);
    if (!client?.assignment_id) { setError("No assignment found for this client."); return; }

    setSaving(true);
    setError("");
    try {
      const supabase = createClient();

      const { error: updateErr } = await supabase
        .from("pt_assignments")
        .update({ status: "inactive" as any })
        .eq("id", client.assignment_id)
        .eq("gym_id", gymId);

      if (updateErr) throw updateErr;

      await supabase.from("audit_logs").insert({
        gym_id: gymId,
        user_id: userId,
        action: "assignment_cancelled",
        entity_type: "pt_assignment",
        entity_id: client.assignment_id,
        old_values: { status: "active" },
        new_values: { status: "inactive" },
      });

      router.refresh();
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Cancel failed.");
      setSaving(false);
    }
  }

  const title =
    mode === "reassign" ? "Reassign Trainer" :
    mode === "cancel" ? "Cancel Assignment" :
    "Slot Details";

  return (
    <Drawer open onClose={onClose} title={title}>
      <div className="space-y-5">
        {/* Back button for sub-modes */}
        {mode !== "view" && (
          <button
            onClick={() => { setMode("view"); setSelectedClientId(null); setError(""); setNewTrainerId(""); }}
            className="flex items-center gap-1.5 text-xs text-[#9B9E96] hover:text-[#E8EBE4] transition-colors"
          >
            ← Back
          </button>
        )}

        {/* Slot header */}
        <div className="bg-[#1A1C18] rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Avatar
              firstName={trainer.first_name}
              lastName={trainer.last_name}
              src={trainer.profile_picture_url ?? null}
              size="sm"
            />
            <div>
              <div className="text-sm font-semibold text-[#E8EBE4]">
                {trainer.first_name} {trainer.last_name}
              </div>
              <div className="text-[10px] text-[#6B6E67]">Trainer</div>
            </div>
            <div
              className={`ml-auto px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${
                isFull
                  ? "bg-red-500/10 text-red-400 border-red-500/30"
                  : "bg-[#B9E84A]/10 text-[#B9E84A] border-[#B9E84A]/30"
              }`}
            >
              {clients.length}/{trainer.max_clients_per_slot}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-[#9B9E96]">
            <span className="flex items-center gap-1.5">
              <Clock size={11} />
              {formatTime(time)}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar size={11} />
              {new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "short",
              })}
            </span>
          </div>
        </div>

        {/* ── VIEW MODE ── */}
        {mode === "view" && (
          <>
            <div>
              <div className="text-[10px] font-semibold text-[#6B6E67] tracking-wider uppercase mb-2">
                Clients in this slot
              </div>
              {clients.length === 0 ? (
                <div className="text-center py-6 text-sm text-[#6B6E67]">No clients in this slot</div>
              ) : (
                <div className="space-y-2">
                  {clients.map((client) => {
                    const pkg = packages[client.id];
                    const remaining = pkg ? Math.max(0, pkg.total_sessions - pkg.sessions_completed) : null;
                    return (
                      <div
                        key={client.id}
                        className="px-4 py-3 bg-[#1A1C18] border border-[#2E3129] rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar
                            firstName={client.first_name}
                            lastName={client.last_name}
                            src={client.profile_picture_url ?? null}
                            size="sm"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[#E8EBE4] truncate">
                              {client.first_name} {client.last_name}
                            </div>
                            {pkg?.package_name && (
                              <div className="text-[10px] text-[#9B9E96] truncate">{pkg.package_name}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {client.id && (
                              <Link
                                href={`/manager/clients/${client.id}`}
                                onClick={onClose}
                                className="flex items-center gap-1 text-[10px] text-[#B9E84A] hover:text-[#D4F76A] transition-colors"
                              >
                                <UserCircle size={11} />
                                Profile
                              </Link>
                            )}
                            {client.assignment_id && (
                              <Link
                                href={`/manager/assignments/${client.assignment_id}`}
                                onClick={onClose}
                                className="flex items-center gap-1 text-[10px] text-[#9B9E96] hover:text-[#E8EBE4] transition-colors"
                              >
                                <ExternalLink size={10} />
                                Assignment
                              </Link>
                            )}
                          </div>
                        </div>
                        {/* Extra info row */}
                        <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-[#6B6E67]">
                          {pkg && (
                            <span>
                              Sessions:{" "}
                              <span className={remaining === 0 ? "text-red-400" : "text-[#9B9E96]"}>
                                {pkg.sessions_completed}/{pkg.total_sessions}
                                {remaining !== null && ` (${remaining} left)`}
                              </span>
                            </span>
                          )}
                          {client.days_of_week && client.days_of_week.length > 0 && (
                            <span>
                              Days: <span className="text-[#9B9E96]">{client.days_of_week.map((d) => DAY_NAMES[d]).join(", ")}</span>
                            </span>
                          )}
                        </div>
                        {/* Row actions */}
                        {client.assignment_id && (
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => { setSelectedClientId(client.id); setMode("reassign"); }}
                              className="flex items-center gap-1 text-[10px] text-[#9B9E96] hover:text-[#B9E84A] transition-colors"
                            >
                              <RefreshCw size={10} /> Reassign
                            </button>
                            <span className="text-[#2E3129]">·</span>
                            <button
                              onClick={() => { setSelectedClientId(client.id); setMode("cancel"); }}
                              className="flex items-center gap-1 text-[10px] text-[#9B9E96] hover:text-red-400 transition-colors"
                            >
                              <X size={10} /> Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2 pt-1 border-t border-[#2E3129]">
              {hasCapacity && (
                <button
                  onClick={onAssignMore}
                  className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-[#B9E84A] text-[#171917] text-sm font-semibold hover:bg-[#A8D63A] transition-colors"
                >
                  <Plus size={14} />
                  Add Client to Slot
                </button>
              )}
              <Link
                href={`/manager/trainers/${trainer.id}`}
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-[#2E3129] text-sm text-[#9B9E96] hover:bg-[#1A1C18] transition-colors"
              >
                View Trainer Profile
              </Link>
            </div>
          </>
        )}

        {/* ── REASSIGN MODE ── */}
        {mode === "reassign" && (
          <div className="space-y-4">
            {(() => {
              const client = clients.find((c) => c.id === selectedClientId);
              return client ? (
                <div className="flex items-center gap-3 px-3 py-2.5 bg-[#1A1C18] rounded-xl">
                  <Avatar firstName={client.first_name} lastName={client.last_name} src={client.profile_picture_url ?? null} size="xs" />
                  <div className="text-sm text-[#E8EBE4] font-medium">{client.first_name} {client.last_name}</div>
                </div>
              ) : null;
            })()}

            <div>
              <label className="text-xs font-medium text-[#E8EBE4] mb-2 block">Select New Trainer</label>
              {availableTrainers.length === 0 ? (
                <div className="text-xs text-[#6B6E67] py-4 text-center">Loading trainers…</div>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {availableTrainers.map((t: any) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setNewTrainerId(t.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                        newTrainerId === t.id
                          ? "bg-[#B9E84A]/10 border-[#B9E84A]"
                          : "bg-[#1A1C18] border-[#2E3129] hover:border-[#E8EBE4]"
                      }`}
                    >
                      <Avatar firstName={t.first_name} lastName={t.last_name} src={t.profile_picture_url} size="xs" />
                      <div className="text-sm text-[#E8EBE4]">{t.first_name} {t.last_name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
                <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setMode("view"); setError(""); setNewTrainerId(""); }}
                className="flex-1 h-10 rounded-xl border border-[#2E3129] text-sm text-[#9B9E96] hover:bg-[#1A1C18] transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleReassign}
                disabled={saving || !newTrainerId}
                className="flex-1 h-10 rounded-xl bg-[#B9E84A] text-[#171917] text-sm font-semibold hover:bg-[#A8D63A] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                {saving ? "Saving…" : "Confirm Reassign"}
              </button>
            </div>
          </div>
        )}

        {/* ── CANCEL MODE ── */}
        {mode === "cancel" && (
          <div className="space-y-4">
            {(() => {
              const client = clients.find((c) => c.id === selectedClientId);
              return client ? (
                <div className="flex items-center gap-3 px-3 py-2.5 bg-[#1A1C18] rounded-xl">
                  <Avatar firstName={client.first_name} lastName={client.last_name} src={client.profile_picture_url ?? null} size="xs" />
                  <div className="text-sm text-[#E8EBE4] font-medium">{client.first_name} {client.last_name}</div>
                </div>
              ) : null;
            })()}

            <div className="flex items-start gap-3 px-3 py-3 bg-orange-500/10 border border-orange-500/30 rounded-xl">
              <AlertTriangle size={14} className="text-orange-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-orange-400">
                This will deactivate the assignment. Existing session history is preserved.
                The client can be re-assigned later.
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
                <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setMode("view"); setError(""); }}
                className="flex-1 h-10 rounded-xl border border-[#2E3129] text-sm text-[#9B9E96] hover:bg-[#1A1C18] transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="flex-1 h-10 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                {saving ? "Cancelling…" : "Cancel Assignment"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}

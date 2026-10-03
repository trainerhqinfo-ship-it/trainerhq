"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { formatTime, DAY_NAMES } from "@/lib/utils";

export default function ReassignPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [assignment, setAssignment] = useState<any>(null);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();

      const { data: assignmentRaw } = await supabase
        .from("pt_assignments")
        .select("*, pt_clients(first_name, last_name), trainers(first_name, last_name)")
        .eq("id", id)
        .single();

      if (!assignmentRaw) { router.push("/manager/assignments"); return; }
      setAssignment(assignmentRaw);

      const { data: trainersData } = await supabase
        .from("trainers")
        .select("id, first_name, last_name, status, max_clients_per_slot, specializations, profile_picture_url")
        .eq("gym_id", (assignmentRaw as any).gym_id)
        .eq("status", "active")
        .neq("id", (assignmentRaw as any).trainer_id);

      const trainerList = trainersData ?? [];

      if (trainerList.length > 0) {
        const trainerIds = trainerList.map((t: any) => t.id);

        // Count capacity at this specific time slot, with days_of_week overlap
        // (same logic as schedule grid — empty days_of_week means all days)
        const slotHour = parseInt(((assignmentRaw as any).preferred_time ?? "00:00").split(":")[0]);
        const movingDays: number[] =
          (assignmentRaw as any).days_of_week?.length > 0
            ? (assignmentRaw as any).days_of_week
            : [0, 1, 2, 3, 4, 5, 6];

        const { data: slotAssignments } = await supabase
          .from("pt_assignments")
          .select("trainer_id, days_of_week")
          .in("trainer_id", trainerIds)
          .eq("status", "active")
          .filter("preferred_time", "like", `${String(slotHour).padStart(2, "0")}%`);

        const countMap: Record<string, number> = {};
        (slotAssignments ?? []).forEach((a: any) => {
          const aDays = a.days_of_week as number[] | null;
          const overlaps = !aDays || aDays.length === 0
            ? true
            : movingDays.some((d: number) => aDays.includes(d));
          if (overlaps) {
            countMap[a.trainer_id] = (countMap[a.trainer_id] ?? 0) + 1;
          }
        });

        const enriched = trainerList.map((t: any) => ({
          ...t,
          currentClients: countMap[t.id] ?? 0,
          slotsAvailable: Math.max(0, (t.max_clients_per_slot ?? 1) - (countMap[t.id] ?? 0)),
        }));

        // Sort: available first, then full
        enriched.sort((a: any, b: any) => b.slotsAvailable - a.slotsAvailable);
        setTrainers(enriched);
      }

      setLoading(false);
    }
    fetchData();
  }, [id, router]);

  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrainer || !assignment) return;

    const chosen = trainers.find(t => t.id === selectedTrainer);
    if (chosen && chosen.slotsAvailable <= 0) return; // guard

    setSubmitting(true);
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("pt_assignments").update({ end_date: today, status: "inactive" as any }).eq("id", id);

    const { data: newAssign } = await supabase.from("pt_assignments").insert({
      gym_id: assignment.gym_id,
      client_id: assignment.client_id,
      trainer_id: selectedTrainer,
      days_of_week: assignment.days_of_week,
      preferred_time: assignment.preferred_time,
      total_sessions: assignment.total_sessions,
      start_date: today,
      assigned_by: user?.id,
      status: "active",
    }).select().single();

    await supabase.from("audit_logs").insert({
      gym_id: assignment.gym_id,
      user_id: user?.id,
      entity_type: "pt_assignment",
      entity_id: id,
      action: "assignment_reassigned",
      old_values: { trainer_id: assignment.trainer_id },
      new_values: { new_assignment_id: (newAssign as any)?.id, new_trainer_id: selectedTrainer, reason },
    });

    router.push("/manager/assignments");
  };

  if (loading) return <div className="p-8 text-sm text-[#9B9E96]">Loading...</div>;
  if (!assignment) return null;

  const client = assignment.pt_clients;
  const currentTrainer = assignment.trainers;
  const days = assignment.days_of_week?.map((d: number) => DAY_NAMES[d]).join(", ") ?? "";

  return (
    <div>
      <Header
        title="Reassign Client"
        subtitle={`${client?.first_name} ${client?.last_name} · currently with ${currentTrainer?.first_name} ${currentTrainer?.last_name}`}
      />
      <div className="px-8 py-6 max-w-2xl space-y-5">

        {/* Current assignment */}
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5">
          <div className="text-xs font-medium text-[#9B9E96] mb-3">Current Assignment</div>
          <div className="flex items-center gap-3">
            <Avatar firstName={client?.first_name ?? "?"} lastName={client?.last_name ?? ""} size="md" />
            <div>
              <div className="text-sm font-medium text-[#E8EBE4]">{client?.first_name} {client?.last_name}</div>
              <div className="text-xs text-[#9B9E96] mt-0.5">{days} · {formatTime(assignment.preferred_time ?? "")}</div>
            </div>
          </div>
        </div>

        <form onSubmit={handleReassign} className="space-y-4">
          <div className="text-xs font-semibold text-[#9B9E96] uppercase tracking-wider">
            Select New Trainer — capacity shown at {formatTime(assignment.preferred_time ?? "")}
          </div>

          <div className="space-y-2">
            {trainers.map(t => {
              const full = t.slotsAvailable <= 0;
              return (
                <label
                  key={t.id}
                  className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${
                    full
                      ? "border-[#2E3129] opacity-50 cursor-not-allowed"
                      : "border-[#2E3129] cursor-pointer hover:border-[#B9E84A] has-[:checked]:border-[#B9E84A] has-[:checked]:bg-[#B9E84A]/5"
                  }`}
                >
                  <input
                    type="radio"
                    name="trainer_id"
                    value={t.id}
                    disabled={full}
                    className="accent-[#B9E84A]"
                    required
                    onChange={e => setSelectedTrainer(e.target.value)}
                  />
                  <Avatar firstName={t.first_name} lastName={t.last_name} src={t.profile_picture_url} size="sm" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-[#E8EBE4]">{t.first_name} {t.last_name}</div>
                    <div className="flex items-center gap-3 mt-1">
                      {/* Slot dots */}
                      <div className="flex gap-1">
                        {Array.from({ length: t.max_clients_per_slot }).map((_: unknown, i: number) => (
                          <div
                            key={i}
                            className={`w-2 h-2 rounded-full ${i < t.currentClients ? "bg-[#9B9E96]" : "bg-[#B9E84A]"}`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-[#9B9E96]">
                        {t.currentClients}/{t.max_clients_per_slot} at this slot
                        {!full && <span className="text-[#B9E84A] ml-1">· {t.slotsAvailable} open</span>}
                        {full && <span className="text-red-400 ml-1">· Full</span>}
                      </span>
                    </div>
                  </div>
                </label>
              );
            })}
            {!trainers.length && (
              <p className="text-sm text-[#9B9E96] py-6 text-center">No other active trainers available</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#9B9E96] mb-1.5">Reason for Reassignment (optional)</label>
            <textarea
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Why is this client being reassigned?"
              className="w-full text-sm border border-[#2E3129] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#B9E84A]/40 focus:border-[#B9E84A] resize-none text-[#E8EBE4] placeholder:text-[#9B9E96] bg-[#222520]"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="submit" variant="primary" size="md" disabled={submitting || !selectedTrainer}>
              {submitting ? "Reassigning..." : "Confirm Reassignment"}
            </Button>
            <a href="/manager/assignments">
              <Button type="button" variant="ghost" size="md">Cancel</Button>
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

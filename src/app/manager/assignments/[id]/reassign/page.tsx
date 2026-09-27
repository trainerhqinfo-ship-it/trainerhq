"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
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
        .select("id, first_name, last_name, status, max_clients_per_slot, specializations")
        .eq("status", "active")
        .neq("id", (assignmentRaw as any).trainer_id);

      setTrainers(trainersData ?? []);
      setLoading(false);
    }
    fetchData();
  }, [id, router]);

  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrainer || !assignment) return;
    setSubmitting(true);

    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    // End current assignment
    await supabase.from("pt_assignments").update({ end_date: today, status: "cancelled" }).eq("id", id);

    // Create new assignment
    const { data: newAssign } = await supabase.from("pt_assignments").insert({
      gym_id: assignment.gym_id,
      client_id: assignment.client_id,
      trainer_id: selectedTrainer,
      days_of_week: assignment.days_of_week,
      preferred_time: assignment.preferred_time,
      start_date: today,
      status: "active",
    }).select().single();

    // Audit log
    await supabase.from("audit_logs").insert({
      gym_id: assignment.gym_id,
      entity_type: "pt_assignment",
      entity_id: id,
      action: "reassign",
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

        <form onSubmit={handleReassign} className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5 space-y-4">
          <div className="text-xs font-medium text-[#9B9E96]">Select New Trainer</div>
          <div className="space-y-2">
            {trainers.map(t => (
              <label key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-[#2E3129] cursor-pointer hover:border-[#B9E84A] has-[:checked]:border-[#B9E84A] has-[:checked]:bg-[#F9FFF0]">
                <input
                  type="radio"
                  name="trainer_id"
                  value={t.id}
                  className="accent-[#B9E84A]"
                  required
                  onChange={e => setSelectedTrainer(e.target.value)}
                />
                <Avatar firstName={t.first_name} lastName={t.last_name} size="sm" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-[#E8EBE4]">{t.first_name} {t.last_name}</div>
                  <div className="text-xs text-[#9B9E96] mt-0.5">Max {t.max_clients_per_slot}/slot</div>
                </div>
                <StatusBadge status={t.status} />
              </label>
            ))}
            {!trainers.length && (
              <p className="text-sm text-[#9B9E96] py-4 text-center">No other active trainers available</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#9B9E96] mb-1.5">Reason for Reassignment</label>
            <textarea
              name="reason"
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Optional: explain why the client is being reassigned..."
              className="w-full text-sm border border-[#2E3129] rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#B9E84A] resize-none text-[#E8EBE4] placeholder:text-[#9B9E96]"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="submit" variant="primary" size="md" disabled={submitting}>
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
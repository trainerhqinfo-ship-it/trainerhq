"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { DAY_NAMES_FULL, formatTime } from "@/lib/utils";
import { Search, X, Clock } from "lucide-react";
import type { Trainer, PtClient } from "@/types/database";

const TIME_SLOTS = Array.from({ length: 34 }, (_, i) => {
  const totalMins = 5 * 60 + i * 30; // 5:00 AM to 9:30 PM
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const label = `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  return { value, label };
});

function ClientSearchSelect({
  clients,
  value,
  onChange,
}: {
  clients: PtClient[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = clients.find(c => c.id === value);

  const filtered = query.trim()
    ? clients.filter(c => {
        const q = query.toLowerCase();
        return (
          `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q)
        );
      })
    : clients;

  // close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function select(client: PtClient) {
    onChange(client.id);
    setQuery("");
    setOpen(false);
  }

  function clear() {
    onChange("");
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="text-xs font-medium text-[#E8EBE4] mb-1.5 block">Client *</label>

      {/* Selected pill or search input */}
      {selected && !open ? (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-[#1A1C18] border border-[#B9E84A]/50 rounded-xl">
          <Avatar firstName={selected.first_name} lastName={selected.last_name} src={selected.profile_picture_url} size="xs" />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-[#E8EBE4] font-medium truncate">{selected.first_name} {selected.last_name}</div>
            {selected.phone && <div className="text-[10px] text-[#6B6E67]">{selected.phone}</div>}
          </div>
          <button type="button" onClick={clear} className="text-[#6B6E67] hover:text-[#E8EBE4] transition-colors flex-shrink-0">
            <X size={13} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6E67] pointer-events-none" />
          <input
            type="text"
            value={query}
            placeholder="Search by name or phone…"
            autoComplete="off"
            onFocus={() => setOpen(true)}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            className="w-full pl-8 pr-3 py-2.5 text-sm bg-[#1A1C18] border border-[#2E3129] rounded-xl text-[#E8EBE4] placeholder-[#4A4D47] focus:outline-none focus:border-[#B9E84A]"
          />
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full mt-1.5 w-full bg-[#1E2020] border border-[#2E3129] rounded-xl shadow-xl overflow-hidden">
          <div className="max-h-56 overflow-y-auto divide-y divide-[#2E3129]">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-xs text-[#6B6E67]">No clients match "{query}"</div>
            ) : (
              filtered.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={() => select(c)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#2E3129] transition-colors text-left"
                >
                  <Avatar firstName={c.first_name} lastName={c.last_name} src={c.profile_picture_url} size="xs" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#E8EBE4] font-medium truncate">{c.first_name} {c.last_name}</div>
                    {c.phone && <div className="text-[10px] text-[#6B6E67]">{c.phone}</div>}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface AssignmentFormProps {
  trainers: (Trainer & { pt_assignments?: any[]; trainer_working_hours?: any[] })[];
  clients: PtClient[];
  preselectedClientId?: string;
}

export function AssignmentForm({ trainers, clients, preselectedClientId }: AssignmentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    client_id: preselectedClientId ?? "",
    trainer_id: "",
    preferred_time: "19:00",
    days_of_week: [1, 3, 5] as number[],
    start_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  function toggleDay(d: number) {
    setFormData(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(d)
        ? prev.days_of_week.filter(x => x !== d)
        : [...prev.days_of_week, d].sort(),
    }));
  }

  // Calculate trainer availability for selected time
  function getTrainerCapacity(trainer: AssignmentFormProps["trainers"][0]) {
    const timeHour = parseInt(formData.preferred_time.split(":")[0]);
    const assignedAtTime = (trainer.pt_assignments ?? []).filter(a => {
      if (a.status !== "active") return false;
      const aHour = parseInt((a.preferred_time as string).split(":")[0]);
      const aDays = a.days_of_week as number[];
      const daysOverlap = !aDays || aDays.length === 0
        ? true
        : formData.days_of_week.some(d => aDays.includes(d));
      return aHour === timeHour && daysOverlap;
    });
    return {
      current: assignedAtTime.length,
      max: trainer.max_clients_per_slot,
      available: trainer.max_clients_per_slot - assignedAtTime.length,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Not authenticated."); setLoading(false); return; }
    const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user.id).single();
    const gymId = profile?.gym_id;
    if (!gymId) { setError("Could not determine gym."); setLoading(false); return; }

    // Frontend capacity pre-check
    const trainer = trainers.find(t => t.id === formData.trainer_id);
    if (trainer) {
      const cap = getTrainerCapacity(trainer);
      if (cap.available <= 0) {
        setError(`${trainer.first_name} is at full capacity for this time slot.`);
        setLoading(false);
        return;
      }
    }

    // Server-side capacity double-check
    const timeHour = parseInt(formData.preferred_time.split(":")[0]);
    const { count } = await supabase
      .from("pt_assignments")
      .select("id", { count: "exact", head: true })
      .eq("trainer_id", formData.trainer_id)
      .eq("status", "active")
      .filter("preferred_time", "gte", `${String(timeHour).padStart(2,"0")}:00`)
      .filter("preferred_time", "lt", `${String(timeHour+1).padStart(2,"0")}:00`);

    const trainerObj = trainers.find(t => t.id === formData.trainer_id);
    if (trainerObj && (count ?? 0) >= trainerObj.max_clients_per_slot) {
      setError(`${trainerObj.first_name} is at full capacity (${count}/${trainerObj.max_clients_per_slot}) — assignment blocked.`);
      setLoading(false);
      return;
    }

    try {
      const { data: assignment, error: err } = await supabase.from("pt_assignments").insert({
        gym_id: gymId,
        client_id: formData.client_id,
        trainer_id: formData.trainer_id,
        days_of_week: formData.days_of_week,
        preferred_time: formData.preferred_time,
        start_date: formData.start_date,
        notes: formData.notes || null,
        assigned_by: user.id,
        status: "active",
      }).select().single();

      if (err) throw err;

      await supabase.from("audit_logs").insert({
        gym_id: gymId,
        user_id: user.id,
        action: "client_assigned",
        entity_type: "pt_assignment",
        entity_id: assignment.id,
        new_values: { client_id: formData.client_id, trainer_id: formData.trainer_id },
      });

      router.push("/manager/assignments");
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-6 space-y-5">
        <ClientSearchSelect
          clients={clients}
          value={formData.client_id}
          onChange={id => setFormData(p => ({ ...p, client_id: id }))}
        />

        <div>
          <label className="text-xs font-medium text-[#E8EBE4] mb-2 block">Schedule Days</label>
          <div className="flex gap-2">
            {[0,1,2,3,4,5,6].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={`w-9 h-9 rounded-lg text-xs font-medium border transition-colors ${
                  formData.days_of_week.includes(d)
                    ? "bg-[#B9E84A] text-[#171917] border-[#A8D63A]"
                    : "bg-[#222520] text-[#6B6E67] border-[#2E3129] hover:border-[#E8EBE4]"
                }`}
              >
                {DAY_NAMES_FULL[d].slice(0, 2)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-[#E8EBE4] mb-1.5 block">Preferred Time *</label>
          <div className="relative">
            <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6E67] pointer-events-none" />
            <select
              value={formData.preferred_time}
              onChange={e => setFormData(p => ({ ...p, preferred_time: e.target.value }))}
              required
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#1A1C18] border border-[#2E3129] rounded-xl text-[#E8EBE4] focus:outline-none focus:border-[#B9E84A] appearance-none cursor-pointer"
            >
              {TIME_SLOTS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Trainer selection with capacity */}
        <div>
          <label className="text-xs font-medium text-[#E8EBE4] mb-2 block">
            Select Trainer — capacity at {formatTime(formData.preferred_time)}
          </label>
          <div className="space-y-2">
            {trainers.map(trainer => {
              const cap = getTrainerCapacity(trainer);
              const isFull = cap.available <= 0;
              return (
                <button
                  key={trainer.id}
                  type="button"
                  disabled={isFull}
                  onClick={() => setFormData(p => ({ ...p, trainer_id: trainer.id }))}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-colors ${
                    formData.trainer_id === trainer.id
                      ? "bg-[#B9E84A]/10 border-[#B9E84A]"
                      : isFull
                        ? "bg-[#1A1C18] border-[#2E3129] opacity-60 cursor-not-allowed"
                        : "bg-[#222520] border-[#2E3129] hover:border-[#E8EBE4]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Avatar firstName={trainer.first_name} lastName={trainer.last_name} size="sm" />
                    <div>
                      <div className="text-sm font-medium text-[#E8EBE4]">
                        {trainer.first_name} {trainer.last_name}
                      </div>
                      <div className="text-xs text-[#6B6E67]">{trainer.specializations?.slice(0, 2).join(", ")}</div>
                    </div>
                  </div>
                  <div className={`px-2.5 py-1 rounded-lg text-xs font-semibold border tabular-nums ${
                    isFull
                      ? "bg-red-500/10 text-red-400 border-red-500/30"
                      : cap.current > 0
                        ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                        : "bg-[#B9E84A]/15 text-[#B9E84A] border-[#B9E84A]/40"
                  }`}>
                    {cap.current}/{cap.max}
                    {isFull ? " FULL" : ` · ${cap.available} open`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <Input
          label="Start Date"
          type="date"
          value={formData.start_date}
          onChange={e => setFormData(p => ({ ...p, start_date: e.target.value }))}
        />
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" variant="primary" loading={loading} disabled={!formData.client_id || !formData.trainer_id}>
          Create Assignment
        </Button>
      </div>
    </form>
  );
}
"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Drawer } from "@/components/ui/dialog";
import { Avatar } from "@/components/ui/avatar";
import { DAY_NAMES, formatTime } from "@/lib/utils";
import { Search, X, Calendar, Clock, AlertTriangle } from "lucide-react";

interface ClientOption {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  profile_picture_url?: string | null;
}

interface TrainerInfo {
  id: string;
  first_name: string;
  last_name: string;
  profile_picture_url?: string | null;
  max_clients_per_slot: number;
}

interface SlotAssignDrawerProps {
  trainer: TrainerInfo;
  date: string;
  time: string;
  available: number;
  clients: ClientOption[];
  gymId: string;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function ClientSearch({
  clients,
  value,
  onChange,
}: {
  clients: ClientOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = clients.find((c) => c.id === value);

  const filtered = query.trim()
    ? clients.filter((c) => {
        const q = query.toLowerCase();
        return (
          `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
          (c.phone ?? "").includes(q)
        );
      })
    : clients;

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  if (selected && !open) {
    return (
      <div ref={ref} className="flex items-center gap-2 px-3 py-2.5 bg-[#1A1C18] border border-[#B9E84A]/50 rounded-xl">
        <Avatar firstName={selected.first_name} lastName={selected.last_name} src={selected.profile_picture_url ?? null} size="xs" />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-[#E8EBE4] font-medium truncate">
            {selected.first_name} {selected.last_name}
          </div>
          {selected.phone && <div className="text-[10px] text-[#6B6E67]">{selected.phone}</div>}
        </div>
        <button
          type="button"
          onClick={() => { onChange(""); setOpen(false); }}
          className="text-[#6B6E67] hover:text-[#E8EBE4] transition-colors"
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6E67] pointer-events-none" />
        <input
          type="text"
          value={query}
          placeholder="Search by name or phone…"
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          className="w-full pl-8 pr-3 py-2.5 text-sm bg-[#1A1C18] border border-[#2E3129] rounded-xl text-[#E8EBE4] placeholder-[#4A4D47] focus:outline-none focus:border-[#B9E84A]"
        />
      </div>
      {open && (
        <div className="absolute z-50 top-full mt-1.5 w-full bg-[#1E2020] border border-[#2E3129] rounded-xl shadow-xl overflow-hidden">
          <div className="max-h-52 overflow-y-auto divide-y divide-[#2E3129]">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-xs text-[#6B6E67]">No clients match</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={() => { onChange(c.id); setQuery(""); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#2E3129] transition-colors text-left"
                >
                  <Avatar firstName={c.first_name} lastName={c.last_name} src={c.profile_picture_url ?? null} size="xs" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#E8EBE4] font-medium truncate">
                      {c.first_name} {c.last_name}
                    </div>
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

export function SlotAssignDrawer({
  trainer,
  date,
  time,
  available,
  clients,
  gymId,
  userId,
  onClose,
  onSuccess,
}: SlotAssignDrawerProps) {
  const router = useRouter();
  const clickedDow = new Date(date + "T00:00:00").getDay();
  const [clientId, setClientId] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([clickedDow]);
  const [startDate, setStartDate] = useState(date);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleDay(d: number) {
    setSelectedDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );
  }

  async function handleAssign() {
    if (!clientId) { setError("Please select a client."); return; }
    if (selectedDays.length === 0) { setError("Select at least one training day."); return; }
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      // Check for duplicate active assignment (DB also enforces this via unique index)
      const { data: existing } = await supabase
        .from("pt_assignments")
        .select("id")
        .eq("gym_id", gymId)
        .eq("trainer_id", trainer.id)
        .eq("client_id", clientId)
        .eq("preferred_time", time)
        .eq("status", "active")
        .maybeSingle();

      if (existing) {
        setError("This client already has an active assignment with this trainer at this time.");
        setLoading(false);
        return;
      }

      const { data: assignment, error: err } = await supabase
        .from("pt_assignments")
        .insert({
          gym_id: gymId,
          client_id: clientId,
          trainer_id: trainer.id,
          preferred_time: time,
          days_of_week: selectedDays,
          start_date: startDate,
          assigned_by: userId,
          status: "active",
        })
        .select()
        .single();

      if (err) throw err;

      await supabase.from("audit_logs").insert({
        gym_id: gymId,
        user_id: userId,
        action: "client_assigned",
        entity_type: "pt_assignment",
        entity_id: assignment.id,
        new_values: {
          client_id: clientId,
          trainer_id: trainer.id,
          preferred_time: time,
          days_of_week: selectedDays,
        },
      });

      router.refresh();
      onSuccess();
    } catch (e: any) {
      setError(e.message ?? "Failed to create assignment.");
      setLoading(false);
    }
  }

  const isAtCapacity = available === 0;

  return (
    <Drawer open onClose={onClose} title="Assign Client to Slot">
      <div className="space-y-5">
        {/* Slot summary */}
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
                isAtCapacity
                  ? "bg-red-500/10 text-red-400 border-red-500/30"
                  : "bg-[#B9E84A]/10 text-[#B9E84A] border-[#B9E84A]/30"
              }`}
            >
              {isAtCapacity ? "FULL" : `${available} open`}
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
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </span>
          </div>
        </div>

        {isAtCapacity && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-orange-500/10 border border-orange-500/30 rounded-xl text-xs text-orange-400">
            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
            <span>This slot is at full capacity. The assignment will still be created as a manager override.</span>
          </div>
        )}

        {/* Client search */}
        <div>
          <label className="text-xs font-medium text-[#E8EBE4] mb-1.5 block">Client *</label>
          <ClientSearch clients={clients} value={clientId} onChange={setClientId} />
        </div>

        {/* Days of week */}
        <div>
          <label className="text-xs font-medium text-[#E8EBE4] mb-2 block">Training Days *</label>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={`flex-shrink-0 w-10 h-9 rounded-lg text-[11px] font-medium border transition-colors ${
                  selectedDays.includes(d)
                    ? "bg-[#B9E84A] text-[#171917] border-[#A8D63A]"
                    : "bg-[#1A1C18] text-[#6B6E67] border-[#2E3129] hover:border-[#E8EBE4]"
                }`}
              >
                {DAY_NAMES[d]}
              </button>
            ))}
          </div>
        </div>

        {/* Start date */}
        <div>
          <label className="text-xs font-medium text-[#E8EBE4] mb-1.5 block">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2.5 text-sm bg-[#1A1C18] border border-[#2E3129] rounded-xl text-[#E8EBE4] focus:outline-none focus:border-[#B9E84A]"
          />
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-[#2E3129] text-sm text-[#9B9E96] hover:bg-[#1A1C18] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAssign}
            disabled={loading || !clientId}
            className="flex-1 h-10 rounded-xl bg-[#B9E84A] text-[#171917] text-sm font-semibold hover:bg-[#A8D63A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Assigning…" : "Assign Client"}
          </button>
        </div>
      </div>
    </Drawer>
  );
}

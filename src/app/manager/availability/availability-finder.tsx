"use client";
import { useState, useMemo } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Search, Clock, Users, CheckCircle, XCircle, ChevronRight } from "lucide-react";
import Link from "next/link";

const DAY_OPTIONS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

const TIME_OPTIONS = Array.from({ length: 32 }, (_, i) => {
  const totalMins = 5 * 60 + i * 30; // 5:00 AM to 9:30 PM in 30-min steps
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const display = h === 0 ? `12:${mm} AM` : h < 12 ? `${h}:${mm} AM` : h === 12 ? `12:${mm} PM` : `${h - 12}:${mm} PM`;
  return { value: `${hh}:${mm}`, label: display };
});

interface Trainer {
  id: string;
  first_name: string;
  last_name: string;
  profile_picture_url: string | null;
  max_clients_per_slot: number;
}

interface WorkingHour {
  trainer_id: string;
  day_of_week: number;
  is_working_day: boolean;
  start_time: string;
  end_time: string;
}

interface Assignment {
  trainer_id: string;
  days_of_week: number[];
  preferred_time: string;
}

interface Props {
  trainers: Trainer[];
  workingHours: WorkingHour[];
  assignments: Assignment[];
}

function SlotDots({ used, max }: { used: number; max: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => (
        <div
          key={i}
          className={`w-2.5 h-2.5 rounded-full transition-colors ${
            i < used ? "bg-[#9B9E96]" : "bg-[#B9E84A]"
          }`}
        />
      ))}
    </div>
  );
}

export function AvailabilityFinder({ trainers, workingHours, assignments }: Props) {
  const todayDow = new Date().getDay();
  const nowH = new Date().getHours();
  const nowM = new Date().getMinutes();
  const defaultTime = TIME_OPTIONS.find(t => {
    const [h, m] = t.value.split(":").map(Number);
    return h * 60 + m >= nowH * 60 + nowM;
  })?.value ?? "07:00";

  const [selectedDay, setSelectedDay] = useState(todayDow);
  const [selectedTime, setSelectedTime] = useState(defaultTime);
  const [searched, setSearched] = useState(false);

  const results = useMemo(() => {
    if (!searched) return null;

    const [qh, qm] = selectedTime.split(":").map(Number);
    const queryMins = qh * 60 + qm;

    return trainers.map(trainer => {
      const wh = workingHours.find(
        w => w.trainer_id === trainer.id && w.day_of_week === selectedDay
      );

      if (!wh || !wh.is_working_day) {
        return { trainer, status: "off" as const, used: 0, free: 0 };
      }

      const [sh, sm] = wh.start_time.split(":").map(Number);
      const [eh, em] = wh.end_time.split(":").map(Number);
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;

      if (queryMins < startMins || queryMins >= endMins) {
        return { trainer, status: "off" as const, used: 0, free: 0 };
      }

      // Count assignments at this day + hour
      const used = assignments.filter(a => {
        if (a.trainer_id !== trainer.id) return false;
        if (!a.days_of_week?.includes(selectedDay)) return false;
        const [ah, am] = (a.preferred_time ?? "").split(":").map(Number);
        return ah === qh; // same hour
      }).length;

      const max = trainer.max_clients_per_slot ?? 1;
      const free = Math.max(0, max - used);
      const status = free > 0 ? ("available" as const) : ("full" as const);

      return { trainer, status, used, free, max };
    });
  }, [searched, selectedDay, selectedTime, trainers, workingHours, assignments]);

  const available = results?.filter(r => r.status === "available") ?? [];
  const full      = results?.filter(r => r.status === "full")      ?? [];
  const off       = results?.filter(r => r.status === "off")       ?? [];

  const selectedDayLabel = DAY_OPTIONS.find(d => d.value === selectedDay)?.label ?? "";
  const selectedTimeLabel = TIME_OPTIONS.find(t => t.value === selectedTime)?.label ?? "";

  return (
    <div className="space-y-5">
      {/* Finder card */}
      <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-7 h-7 rounded-lg bg-[#B9E84A]/15 flex items-center justify-center">
            <Search size={13} className="text-[#B9E84A]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#E8EBE4]">Check Trainer Availability</h2>
            <p className="text-[11px] text-[#6B6E67]">Pick a day and time to see who has open slots</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {/* Day picker */}
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[11px] font-medium text-[#9B9E96] mb-1.5 uppercase tracking-wide">Day</label>
            <div className="relative">
              <Clock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6E67]" />
              <select
                value={selectedDay}
                onChange={e => { setSelectedDay(Number(e.target.value)); setSearched(false); }}
                className="w-full pl-8 pr-3 py-2.5 text-sm border border-[#2E3129] rounded-xl bg-[#1A1C18] text-[#E8EBE4] focus:outline-none focus:border-[#B9E84A] appearance-none cursor-pointer"
              >
                {DAY_OPTIONS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Time picker */}
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[11px] font-medium text-[#9B9E96] mb-1.5 uppercase tracking-wide">Time Slot</label>
            <div className="relative">
              <Clock size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6E67]" />
              <select
                value={selectedTime}
                onChange={e => { setSelectedTime(e.target.value); setSearched(false); }}
                className="w-full pl-8 pr-3 py-2.5 text-sm border border-[#2E3129] rounded-xl bg-[#1A1C18] text-[#E8EBE4] focus:outline-none focus:border-[#B9E84A] appearance-none cursor-pointer"
              >
                {TIME_OPTIONS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Check button */}
          <button
            onClick={() => setSearched(true)}
            className="h-10 px-5 bg-[#B9E84A] text-[#171917] font-semibold text-sm rounded-xl hover:bg-[#A8D63A] transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Search size={14} /> Check Availability
          </button>
        </div>
      </div>

      {/* Results */}
      {results && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">

          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-[#9B9E96]">
              {selectedDayLabel} · {selectedTimeLabel}
            </span>
            <span className="text-[#3A3D35]">·</span>
            <span className="flex items-center gap-1.5 bg-[#B9E84A]/10 border border-[#B9E84A]/30 px-2.5 py-1 rounded-full">
              <CheckCircle size={10} className="text-[#B9E84A]" />
              <span className="text-[#B9E84A] font-semibold">{available.length}</span>
              <span className="text-[#B9E84A]/70">available</span>
            </span>
            <span className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/25 px-2.5 py-1 rounded-full">
              <XCircle size={10} className="text-red-400" />
              <span className="text-red-400 font-semibold">{full.length}</span>
              <span className="text-red-400/70">full</span>
            </span>
            <span className="flex items-center gap-1.5 bg-[#1A1C18] border border-[#2E3129] px-2.5 py-1 rounded-full">
              <span className="text-[#6B6E67] font-semibold">{off.length}</span>
              <span className="text-[#6B6E67]">not working</span>
            </span>
          </div>

          {/* Available trainers */}
          {available.length > 0 && (
            <div className="bg-[#222520] border border-[#B9E84A]/25 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#B9E84A]/15 flex items-center gap-2">
                <CheckCircle size={13} className="text-[#B9E84A]" />
                <span className="text-sm font-semibold text-[#E8EBE4]">Available</span>
                <span className="text-xs text-[#9B9E96]">({available.length} trainer{available.length !== 1 ? "s" : ""} with open slots)</span>
              </div>
              <div className="divide-y divide-[#1A1C18]">
                {available
                  .sort((a, b) => b.free - a.free)
                  .map(({ trainer, used, free, max }) => (
                    <div key={trainer.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[#1E2020]/50 transition-colors">
                      <Avatar firstName={trainer.first_name} lastName={trainer.last_name} src={trainer.profile_picture_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[#E8EBE4]">
                          {trainer.first_name} {trainer.last_name}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <SlotDots used={used!} max={max!} />
                          <span className="text-xs text-[#9B9E96]">
                            {used}/{max} clients
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-[#B9E84A] tabular-nums">{free}</div>
                        <div className="text-[10px] text-[#9B9E96]">slot{free !== 1 ? "s" : ""} free</div>
                      </div>
                      <Link
                        href={`/manager/trainers/${trainer.id}`}
                        className="flex items-center gap-1 text-xs text-[#9B9E96] hover:text-[#E8EBE4] border border-[#2E3129] px-2.5 py-1.5 rounded-lg hover:border-[#B9E84A]/40 transition-colors"
                      >
                        View <ChevronRight size={11} />
                      </Link>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* No available trainers */}
          {available.length === 0 && (
            <div className="bg-[#222520] border border-[#2E3129] rounded-2xl px-5 py-8 text-center">
              <div className="text-2xl mb-2">😔</div>
              <div className="text-sm font-semibold text-[#E8EBE4] mb-1">No available trainers</div>
              <div className="text-xs text-[#6B6E67]">All trainers are full or not working at this time</div>
            </div>
          )}

          {/* Full trainers */}
          {full.length > 0 && (
            <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#1A1C18] flex items-center gap-2">
                <Users size={13} className="text-red-400" />
                <span className="text-sm font-semibold text-[#E8EBE4]">Fully Booked</span>
              </div>
              <div className="divide-y divide-[#1A1C18]">
                {full.map(({ trainer, used, max }) => (
                  <div key={trainer.id} className="flex items-center gap-4 px-5 py-3 opacity-60">
                    <Avatar firstName={trainer.first_name} lastName={trainer.last_name} src={trainer.profile_picture_url} size="sm" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[#E8EBE4]">{trainer.first_name} {trainer.last_name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <SlotDots used={used!} max={max!} />
                        <span className="text-xs text-[#9B9E96]">{used}/{max} — full</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full font-medium">FULL</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Not working */}
          {off.length > 0 && (
            <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#1A1C18]">
                <span className="text-sm font-semibold text-[#E8EBE4]">Not Working</span>
                <span className="text-xs text-[#6B6E67] ml-2">at this time</span>
              </div>
              <div className="px-5 py-3 flex flex-wrap gap-2">
                {off.map(({ trainer }) => (
                  <div key={trainer.id} className="flex items-center gap-1.5 bg-[#1A1C18] border border-[#2E3129] px-2.5 py-1.5 rounded-lg opacity-50">
                    <Avatar firstName={trainer.first_name} lastName={trainer.last_name} size="xs" />
                    <span className="text-xs text-[#9B9E96]">{trainer.first_name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

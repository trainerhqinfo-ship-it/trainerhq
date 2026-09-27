"use client";
import { useState, useMemo } from "react";
import { Avatar } from "@/components/ui/avatar";
import { CheckCircle, XCircle, Users, ChevronRight, Search } from "lucide-react";
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

const TIME_OPTIONS = Array.from({ length: 18 }, (_, i) => {
  const h = i + 5; // 5 AM to 10 PM
  const next = h + 1;
  const fmt = (n: number) => n === 0 ? "12 AM" : n < 12 ? `${n} AM` : n === 12 ? "12 PM" : `${n - 12} PM`;
  return { value: h, label: `${fmt(h)} – ${fmt(next)}` };
});

function fmtHour(h: number): string {
  if (h === 0)  return "12am";
  if (h < 12)   return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

function slotLabel(h: number): string {
  return `${fmtHour(h)}–${fmtHour(h + 1)}`;
}

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

export function AvailabilityFinder({ trainers, workingHours, assignments }: Props) {
  const todayDow = new Date().getDay();
  const nowH = new Date().getHours();
  const defaultHour = Math.min(Math.max(nowH, 5), 22);

  const [selectedDay, setSelectedDay] = useState(todayDow);
  const [selectedHour, setSelectedHour] = useState(defaultHour);
  const [searched, setSearched] = useState(false);

  const results = useMemo(() => {
    if (!searched) return null;

    return trainers.map(trainer => {
      const wh = workingHours.find(
        w => w.trainer_id === trainer.id && w.day_of_week === selectedDay
      );

      if (!wh || !wh.is_working_day) return { trainer, status: "off" as const, freeSlots: [], used: 0, max: 0 };

      const [sh] = wh.start_time.split(":").map(Number);
      const [eh] = wh.end_time.split(":").map(Number);

      if (selectedHour < sh || selectedHour >= eh) return { trainer, status: "off" as const, freeSlots: [], used: 0, max: 0 };

      const max = trainer.max_clients_per_slot ?? 1;

      // empty days_of_week means the assignment applies every day
      const matchesDay = (a: Assignment) => {
        const d = a.days_of_week;
        return !d || d.length === 0 || d.includes(selectedDay);
      };

      // how many assignments at the selected hour
      const used = assignments.filter(a => {
        if (a.trainer_id !== trainer.id) return false;
        if (!matchesDay(a)) return false;
        const [ah] = (a.preferred_time ?? "").split(":").map(Number);
        return ah === selectedHour;
      }).length;

      // collect all slots for the day with their booking count
      const daySlots: { hour: number; used: number }[] = [];
      for (let h = sh; h < eh; h++) {
        const u = assignments.filter(a => {
          if (a.trainer_id !== trainer.id) return false;
          if (!matchesDay(a)) return false;
          const [ah] = (a.preferred_time ?? "").split(":").map(Number);
          return ah === h;
        }).length;
        daySlots.push({ hour: h, used: u });
      }

      // green = 0 clients booked; red = any clients booked
      const status = used === 0 ? ("free" as const) : ("booked" as const);
      return { trainer, status, daySlots, used, max };
    });
  }, [searched, selectedDay, selectedHour, trainers, workingHours, assignments]);

  const free   = results?.filter(r => r.status === "free")   ?? [];
  const booked = results?.filter(r => r.status === "booked") ?? [];
  const off    = results?.filter(r => r.status === "off")    ?? [];

  const dayLabel  = DAY_OPTIONS.find(d => d.value === selectedDay)?.label ?? "";
  const timeLabel = TIME_OPTIONS.find(t => t.value === selectedHour)?.label ?? "";

  return (
    <div className="space-y-4">
      {/* Selectors */}
      <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[#E8EBE4]">Find Available Trainer</h2>
          <p className="text-[11px] text-[#6B6E67] mt-0.5">Select a day and time to see who is free</p>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {/* Day */}
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-semibold text-[#6B6E67] uppercase tracking-wide mb-1.5">Day</label>
            <select
              value={selectedDay}
              onChange={e => { setSelectedDay(Number(e.target.value)); setSearched(false); }}
              className="w-full px-3 py-2.5 text-sm border border-[#2E3129] rounded-xl bg-[#1A1C18] text-[#E8EBE4] focus:outline-none focus:border-[#B9E84A] appearance-none cursor-pointer"
            >
              {DAY_OPTIONS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* Time */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] font-semibold text-[#6B6E67] uppercase tracking-wide mb-1.5">Time Slot</label>
            <select
              value={selectedHour}
              onChange={e => { setSelectedHour(Number(e.target.value)); setSearched(false); }}
              className="w-full px-3 py-2.5 text-sm border border-[#2E3129] rounded-xl bg-[#1A1C18] text-[#E8EBE4] focus:outline-none focus:border-[#B9E84A] appearance-none cursor-pointer"
            >
              {TIME_OPTIONS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Search */}
          <button
            onClick={() => setSearched(true)}
            className="h-10 px-5 bg-[#B9E84A] text-[#171917] font-semibold text-sm rounded-xl hover:bg-[#A8D63A] transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <Search size={14} /> Search
          </button>
        </div>
      </div>

      {/* Results */}
      {results && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-[#9B9E96]">{dayLabel} · {timeLabel}</span>
            <span className="text-[#3A3D35]">·</span>
            <span className="flex items-center gap-1.5 bg-[#B9E84A]/10 border border-[#B9E84A]/30 px-2.5 py-1 rounded-full">
              <CheckCircle size={10} className="text-[#B9E84A]" />
              <span className="text-[#B9E84A] font-semibold">{free.length}</span>
              <span className="text-[#B9E84A]/70">free</span>
            </span>
            <span className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/25 px-2.5 py-1 rounded-full">
              <XCircle size={10} className="text-red-400" />
              <span className="text-red-400 font-semibold">{booked.length}</span>
              <span className="text-red-400/70">booked</span>
            </span>
            <span className="flex items-center gap-1.5 bg-[#1A1C18] border border-[#2E3129] px-2.5 py-1 rounded-full">
              <span className="text-[#6B6E67] font-semibold">{off.length}</span>
              <span className="text-[#6B6E67]">not working</span>
            </span>
          </div>

          {/* Free trainers */}
          {free.length > 0 ? (
            <div className="bg-[#222520] border border-[#B9E84A]/25 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#B9E84A]/15 flex items-center gap-2">
                <CheckCircle size={13} className="text-[#B9E84A]" />
                <span className="text-sm font-semibold text-[#E8EBE4]">Free</span>
                <span className="text-xs text-[#9B9E96]">— no clients booked at this time</span>
              </div>
              <div className="divide-y divide-[#1A1C18]">
                {free.map((r: any) => (
                  <div key={r.trainer.id} className="px-5 py-4 hover:bg-[#1E2020]/50 transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar firstName={r.trainer.first_name} lastName={r.trainer.last_name} src={r.trainer.profile_picture_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[#E8EBE4]">{r.trainer.first_name} {r.trainer.last_name}</div>
                        <div className="text-[11px] text-[#B9E84A] mt-0.5">0/{r.max} clients — completely free</div>
                      </div>
                      <Link
                        href={`/manager/trainers/${r.trainer.id}`}
                        className="flex items-center gap-1 text-xs text-[#9B9E96] hover:text-[#E8EBE4] border border-[#2E3129] px-2.5 py-1.5 rounded-lg hover:border-[#B9E84A]/40 transition-colors flex-shrink-0"
                      >
                        View <ChevronRight size={11} />
                      </Link>
                    </div>
                    {/* Other slots for the day */}
                    <div className="flex flex-wrap gap-1.5">
                      {r.daySlots.map((s: any) => (
                        <span
                          key={s.hour}
                          className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg ${
                            s.hour === selectedHour
                              ? "bg-[#B9E84A] text-[#171917]"
                              : s.used === 0
                              ? "bg-[#B9E84A]/12 border border-[#B9E84A]/30 text-[#B9E84A]"
                              : "bg-red-500/10 border border-red-500/25 text-red-400"
                          }`}
                        >
                          {slotLabel(s.hour)}
                          {s.used > 0 && <span className="text-[9px] opacity-70">{s.used}/{r.max}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-[#222520] border border-[#2E3129] rounded-2xl px-5 py-8 text-center">
              <div className="text-2xl mb-2">😔</div>
              <div className="text-sm font-semibold text-[#E8EBE4] mb-1">No free trainers at {timeLabel}</div>
              <div className="text-xs text-[#6B6E67]">Try a different time or day</div>
            </div>
          )}

          {/* Booked trainers */}
          {booked.length > 0 && (
            <div className="bg-[#222520] border border-red-500/20 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-red-500/10 flex items-center gap-2">
                <Users size={13} className="text-red-400" />
                <span className="text-sm font-semibold text-[#E8EBE4]">Booked</span>
                <span className="text-xs text-[#9B9E96]">— already has clients at this time</span>
              </div>
              <div className="divide-y divide-[#1A1C18]">
                {booked.map((r: any) => (
                  <div key={r.trainer.id} className="px-5 py-4 opacity-70">
                    <div className="flex items-center gap-3 mb-2">
                      <Avatar firstName={r.trainer.first_name} lastName={r.trainer.last_name} src={r.trainer.profile_picture_url} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[#E8EBE4]">{r.trainer.first_name} {r.trainer.last_name}</div>
                        <div className="text-[11px] text-red-400 mt-0.5">{r.used}/{r.max} clients booked</div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                        r.used >= r.max
                          ? "text-red-400 bg-red-500/10 border border-red-500/20"
                          : "text-orange-400 bg-orange-500/10 border border-orange-500/20"
                      }`}>
                        {r.used >= r.max ? "FULL" : `${r.used}/${r.max}`}
                      </span>
                    </div>
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
                {off.map((r: any) => (
                  <div key={r.trainer.id} className="flex items-center gap-1.5 bg-[#1A1C18] border border-[#2E3129] px-2.5 py-1.5 rounded-lg opacity-50">
                    <Avatar firstName={r.trainer.first_name} lastName={r.trainer.last_name} size="xs" />
                    <span className="text-xs text-[#9B9E96]">{r.trainer.first_name}</span>
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

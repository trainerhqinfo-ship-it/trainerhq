"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X, Clock, User, TrendingUp, CheckCircle2, CalendarX2, CalendarCheck } from "lucide-react";
import { formatTime } from "@/lib/utils";

const GRID_START = 6;   // 6 AM
const GRID_END   = 22;  // 10 PM
const HOUR_H     = 64;  // px per hour
const TOTAL_H    = (GRID_END - GRID_START) * HOUR_H;

const STATUS_STYLE: Record<string, { card: string; dot: string; label: string }> = {
  completed:   { card: "border-l-[#B9E84A] bg-[#B9E84A]/10 hover:bg-[#B9E84A]/15",  dot: "bg-[#B9E84A]", label: "Completed" },
  scheduled:   { card: "border-l-sky-400 bg-sky-400/10 hover:bg-sky-400/15",         dot: "bg-sky-400",   label: "Scheduled" },
  cancelled:   { card: "border-l-red-400 bg-red-400/10 hover:bg-red-400/15",          dot: "bg-red-400",   label: "Cancelled" },
  no_show:     { card: "border-l-orange-400 bg-orange-400/10 hover:bg-orange-400/15", dot: "bg-orange-400",label: "No Show"   },
  rescheduled: { card: "border-l-purple-400 bg-purple-400/10 hover:bg-purple-400/15", dot: "bg-purple-400",label: "Rescheduled"},
};

function sessionPos(startTime: string, endTime?: string | null) {
  const [sh, sm] = startTime.split(":").map(Number);
  const endT = endTime ?? `${String(sh + 1).padStart(2,"0")}:00:00`;
  const [eh, em] = endT.split(":").map(Number);
  const startMins = sh * 60 + sm;
  const endMins   = eh * 60 + em;
  const dur = endMins - startMins || 60;
  const top    = ((startMins - GRID_START * 60) / 60) * HOUR_H;
  const height = (dur / 60) * HOUR_H;
  return { top: Math.max(0, top), height: Math.max(28, height) };
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: GRID_END - GRID_START }, (_, i) => GRID_START + i);

function formatHour(h: number) {
  if (h === 0 || h === 24) return "12 AM";
  if (h === 12) return "12 PM";
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
}

interface Session {
  id: string;
  session_date: string;
  start_time: string;
  end_time?: string | null;
  status: string;
  session_revenue?: number | null;
  pt_clients?: { first_name: string; last_name: string } | null;
}

interface WorkingHour {
  day_of_week: number;
  is_working_day: boolean;
  start_time: string;
  end_time: string;
}

interface Props {
  sessions: Session[];
  weekStart: string;
  workingHours: WorkingHour[];
  todayIST: string;
}

export function ScheduleCalendar({ sessions, weekStart, workingHours, todayIST }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Session | null>(null);
  const [nowTop, setNowTop]     = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Live clock → current-time line
  useEffect(() => {
    function update() {
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      const top  = ((mins - GRID_START * 60) / 60) * HOUR_H;
      setNowTop(top >= 0 && top <= TOTAL_H ? top : null);
    }
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, []);

  // Auto-scroll to current time (or 8 AM) on mount
  useEffect(() => {
    if (!scrollRef.current) return;
    const scrollTo = nowTop != null ? Math.max(0, nowTop - 120) : (8 - GRID_START) * HOUR_H;
    scrollRef.current.scrollTop = scrollTo;
  }, []);

  function shift(delta: number) {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + delta * 7);
    router.push(`/trainer/schedule?week=${d.toISOString().split("T")[0]}`);
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + i);
    const dateStr  = d.toISOString().split("T")[0];
    const jsDay    = d.getDay();
    const wh       = workingHours.find((w) => w.day_of_week === jsDay);
    const daySess  = sessions.filter((s) => s.session_date === dateStr);
    return { dateStr, d, jsDay, wh, sessions: daySess, isToday: dateStr === todayIST };
  });

  const weekLabel = (() => {
    const s = days[0].d;
    const e = days[6].d;
    return `${s.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
  })();

  const completed = sessions.filter((s) => s.status === "completed").length;
  const upcoming  = sessions.filter((s) => s.status === "scheduled").length;
  const cancelled = sessions.filter((s) => s.status === "cancelled" || s.status === "no_show").length;

  return (
    <div className="space-y-4">

      {/* ── Top bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="w-8 h-8 rounded-lg border border-[#2E3129] flex items-center justify-center hover:bg-[#2E3129] transition-colors text-[#E8EBE4]">
            <ChevronLeft size={15} />
          </button>
          <button onClick={() => router.push("/trainer/schedule")} className="text-xs border border-[#2E3129] text-[#9B9E96] px-3 h-8 rounded-lg hover:bg-[#2E3129] transition-colors flex items-center gap-1.5">
            <CalendarCheck size={11} /> Today
          </button>
          <button onClick={() => shift(1)} className="w-8 h-8 rounded-lg border border-[#2E3129] flex items-center justify-center hover:bg-[#2E3129] transition-colors text-[#E8EBE4]">
            <ChevronRight size={15} />
          </button>
          <span className="text-sm font-semibold text-[#E8EBE4] ml-1">{weekLabel}</span>
        </div>

        {/* Stats chips */}
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 bg-[#222520] border border-[#2E3129] px-2.5 py-1 rounded-full">
            <TrendingUp size={11} className="text-[#9B9E96]" />
            <span className="text-[#E8EBE4] font-semibold">{sessions.length}</span>
            <span className="text-[#9B9E96]">sessions</span>
          </span>
          <span className="flex items-center gap-1.5 bg-[#B9E84A]/10 border border-[#B9E84A]/30 px-2.5 py-1 rounded-full">
            <CheckCircle2 size={11} className="text-[#B9E84A]" />
            <span className="text-[#B9E84A] font-semibold">{completed}</span>
            <span className="text-[#B9E84A]/70">done</span>
          </span>
          <span className="flex items-center gap-1.5 bg-sky-400/10 border border-sky-400/30 px-2.5 py-1 rounded-full">
            <Clock size={11} className="text-sky-400" />
            <span className="text-sky-400 font-semibold">{upcoming}</span>
            <span className="text-sky-400/70">upcoming</span>
          </span>
          {cancelled > 0 && (
            <span className="flex items-center gap-1.5 bg-red-400/10 border border-red-400/30 px-2.5 py-1 rounded-full">
              <CalendarX2 size={11} className="text-red-400" />
              <span className="text-red-400 font-semibold">{cancelled}</span>
              <span className="text-red-400/70">missed</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Calendar ── */}
      <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">

        {/* Day header row */}
        <div className="flex border-b border-[#2E3129] bg-[#1E2020]">
          <div className="w-[52px] flex-shrink-0 border-r border-[#2E3129]" />
          {days.map((day, i) => (
            <div key={day.dateStr} className={`flex-1 text-center py-3 border-r border-[#2E3129] last:border-r-0 ${day.isToday ? "bg-[#B9E84A]/8" : ""}`}>
              <div className={`text-[11px] font-medium tracking-wide uppercase ${day.isToday ? "text-[#B9E84A]" : "text-[#6B6E67]"}`}>
                {DAY_LABELS[i]}
              </div>
              <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full mt-0.5 text-base font-bold tabular-nums ${
                day.isToday ? "bg-[#B9E84A] text-[#171917]" : "text-[#E8EBE4]"
              }`}>
                {day.d.getDate()}
              </div>
              {day.sessions.length > 0 && (
                <div className="flex justify-center gap-0.5 mt-1">
                  {day.sessions.slice(0, 4).map((s) => (
                    <div key={s.id} className={`w-1 h-1 rounded-full ${(STATUS_STYLE[s.status] ?? STATUS_STYLE.scheduled).dot}`} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Scrollable time grid */}
        <div ref={scrollRef} className="flex overflow-y-auto" style={{ maxHeight: 580 }}>

          {/* Time gutter */}
          <div className="w-[52px] flex-shrink-0 border-r border-[#2E3129] relative bg-[#1E2020]" style={{ height: TOTAL_H }}>
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute right-2 text-[10px] text-[#6B6E67] leading-none"
                style={{ top: (h - GRID_START) * HOUR_H - 6 }}
              >
                {formatHour(h)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => (
            <div key={day.dateStr} className={`flex-1 border-r border-[#2E3129] last:border-r-0 relative ${day.isToday ? "bg-[#B9E84A]/3" : ""}`} style={{ height: TOTAL_H }}>

              {/* Hour lines */}
              {HOURS.map((h) => (
                <div key={h} className={`absolute left-0 right-0 border-t ${h % 2 === 0 ? "border-[#2E3129]" : "border-[#252722]"}`}
                  style={{ top: (h - GRID_START) * HOUR_H }} />
              ))}

              {/* Working hours shading */}
              {day.wh?.is_working_day && (() => {
                const [sh] = day.wh.start_time.split(":").map(Number);
                const [eh] = day.wh.end_time.split(":").map(Number);
                return (
                  <div className="absolute left-0 right-0 bg-[#2E3129]/25"
                    style={{
                      top: Math.max(0, (sh - GRID_START) * HOUR_H),
                      height: (eh - sh) * HOUR_H,
                    }}
                  />
                );
              })()}

              {/* Current time indicator */}
              {day.isToday && nowTop != null && (
                <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: nowTop }}>
                  <div className="flex items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400 -ml-1.5 shadow-[0_0_6px_rgba(248,113,113,0.8)] flex-shrink-0" />
                    <div className="flex-1 h-px bg-red-400 opacity-80" />
                  </div>
                </div>
              )}

              {/* Session blocks */}
              {day.sessions.map((session) => {
                const { top, height } = sessionPos(session.start_time, session.end_time);
                const st = STATUS_STYLE[session.status] ?? STATUS_STYLE.scheduled;
                const client = session.pt_clients;
                const isSelected = selected?.id === session.id;
                return (
                  <button
                    key={session.id}
                    onClick={() => setSelected(isSelected ? null : session)}
                    className={`absolute left-1 right-1 rounded-lg border-l-[3px] px-2 pt-1 pb-0.5 text-left transition-all cursor-pointer z-10 ${st.card} ${isSelected ? "ring-1 ring-white/30 brightness-125" : ""}`}
                    style={{ top: top + 2, height: Math.max(height - 4, 26) }}
                  >
                    <div className="text-[11px] font-semibold leading-tight truncate text-[#E8EBE4]">
                      {client?.first_name} {client?.last_name}
                    </div>
                    {height >= 40 && (
                      <div className="text-[9px] text-[#9B9E96] mt-0.5">{formatTime(session.start_time)}</div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Session detail ── */}
      {selected && (() => {
        const st = STATUS_STYLE[selected.status] ?? STATUS_STYLE.scheduled;
        const client = selected.pt_clients;
        return (
          <div className={`rounded-2xl border border-[#2E3129] bg-[#222520] p-5 animate-in fade-in slide-in-from-bottom-2 duration-200`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${st.dot}`} />
                <span className="text-sm font-semibold text-[#E8EBE4]">Session Details</span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st.card} border-l-0 !bg-opacity-100`}
                  style={{ border: "1px solid currentColor", opacity: 1 }}>
                  {st.label}
                </span>
              </div>
              <button onClick={() => setSelected(null)} className="text-[#6B6E67] hover:text-[#E8EBE4] transition-colors">
                <X size={15} />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="flex items-center gap-1 text-[10px] text-[#9B9E96] mb-1"><User size={10} /> Client</div>
                <div className="text-sm font-semibold text-[#E8EBE4]">{client?.first_name} {client?.last_name}</div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-[10px] text-[#9B9E96] mb-1"><Clock size={10} /> Time</div>
                <div className="text-sm font-semibold text-[#E8EBE4]">{formatTime(selected.start_time)}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#9B9E96] mb-1">Date</div>
                <div className="text-sm font-semibold text-[#E8EBE4]">
                  {new Date(selected.session_date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                </div>
              </div>
              {selected.session_revenue != null && (
                <div>
                  <div className="flex items-center gap-1 text-[10px] text-[#9B9E96] mb-1"><TrendingUp size={10} /> Revenue</div>
                  <div className="text-sm font-semibold text-[#E8EBE4]">₹{Number(selected.session_revenue).toLocaleString("en-IN")}</div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#6B6E67] px-1">
        {Object.entries(STATUS_STYLE).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${val.dot}`} />
            {val.label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 ml-2">
          <div className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_4px_rgba(248,113,113,0.7)]" />
          Current time
        </div>
      </div>
    </div>
  );
}

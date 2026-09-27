import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { AlertTriangle, Bell, Plus, Link2, CalendarDays } from "lucide-react";
import Link from "next/link";

interface HourBucket {
  hour: number;
  count: number;
}

function PeakHoursChart({ data }: { data: HourBucket[] }) {
  const W = 680;
  const H = 180;
  const padL = 36;
  const padR = 16;
  const padT = 12;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const allHours = Array.from({ length: 17 }, (_, i) => i + 6);
  const merged = allHours.map(h => ({
    hour: h,
    count: data.find(d => d.hour === h)?.count ?? 0,
  }));
  const maxCount = Math.max(...merged.map(d => d.count), 1);

  const xAt = (h: number) => padL + ((h - 6) / 16) * innerW;
  const yAt = (v: number) => padT + innerH - (v / maxCount) * innerH;

  const linePath = merged
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(p.hour).toFixed(1)} ${yAt(p.count).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${xAt(22).toFixed(1)} ${yAt(0).toFixed(1)} L ${xAt(6).toFixed(1)} ${yAt(0).toFixed(1)} Z`;

  const peakPoint = merged.reduce((best, p) => (p.count > best.count ? p : best), merged[0]);
  const yGridValues = [0, Math.round(maxCount / 2), maxCount];
  const xLabelHours = [6, 8, 10, 12, 14, 16, 18, 20, 22];

  const hourLabel = (h: number) => {
    if (h === 12) return "12PM";
    return h < 12 ? `${h}AM` : `${h - 12}PM`;
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-[#6B6E67]">
        No sessions scheduled today
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", minWidth: 320, height: "auto", display: "block" }}
        aria-label="PT sessions by hour"
      >
        {yGridValues.map(v => (
          <g key={v}>
            <line x1={padL} y1={yAt(v)} x2={W - padR} y2={yAt(v)} stroke="#2E3129" strokeWidth={1} />
            <text x={padL - 6} y={yAt(v) + 3.5} textAnchor="end" fill="#6B6E67" fontSize={9}>{v}</text>
          </g>
        ))}
        <path d={areaPath} fill="#B9E84A" fillOpacity={0.18} />
        <path d={linePath} fill="none" stroke="#B9E84A" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {peakPoint.count > 0 && (
          <>
            <circle cx={xAt(peakPoint.hour)} cy={yAt(peakPoint.count)} r={4} fill="#B9E84A" />
            <text x={xAt(peakPoint.hour)} y={yAt(peakPoint.count) - 8} textAnchor="middle" fill="#B9E84A" fontSize={9} fontWeight="600">
              {peakPoint.count}
            </text>
          </>
        )}
        {xLabelHours.map(h => (
          <text key={h} x={xAt(h)} y={H - 6} textAnchor="middle" fill="#6B6E67" fontSize={9}>
            {hourLabel(h)}
          </text>
        ))}
      </svg>
    </div>
  );
}

function KpiCard({ label, value, accent = false }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className={`bg-[#222520] rounded-2xl p-5 border ${accent ? "border-[#B9E84A]/60" : "border-[#2E3129]"}`}>
      <div className="text-[11px] font-medium text-[#6B6E67] uppercase tracking-wide mb-2">{label}</div>
      <div className="text-3xl font-bold text-[#E8EBE4] tabular-nums leading-none">{value}</div>
    </div>
  );
}

function getGreeting(): string {
  const h = parseInt(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function ManagerDashboard() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("first_name, gym_id").eq("id", user.id).single();
  const gymId = profile?.gym_id;
  if (!gymId) redirect("/login");

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD in IST

  const [
    { data: gymData },
    { data: trainersRaw },
    { data: clientsRaw },
    { data: sessionsRaw },
    { data: leavesRaw },
    { data: flaggedRaw },
  ] = await Promise.all([
    supabase.from("gyms").select("name, branch_name").eq("id", gymId).single(),
    supabase.from("trainers").select("id, status, max_clients_per_slot, first_name, last_name").eq("gym_id", gymId),
    supabase.from("pt_clients").select("id").eq("gym_id", gymId).eq("status", "active"),
    supabase.from("pt_sessions").select("id, status, start_time, trainer_id").eq("gym_id", gymId).eq("session_date", today),
    supabase.from("trainer_leaves").select("trainer_id").eq("gym_id", gymId).lte("start_date", today).gte("end_date", today),
    supabase.from("trainer_feedback").select("id").eq("gym_id", gymId).eq("is_flagged", true),
  ]);

  const trainers = trainersRaw ?? [];
  const sessions = sessionsRaw ?? [];
  const leaves = leavesRaw ?? [];
  const flagged = flaggedRaw ?? [];

  const active = trainers.filter(t => t.status === "active");
  const leaveIds = new Set(leaves.map((l: any) => l.trainer_id));

  const todayTotal = sessions.length;
  const todayCompleted = sessions.filter(s => s.status === "completed").length;
  const todayUpcoming = sessions.filter(s => s.status === "scheduled").length;
  const totalCap = active.reduce((s, t) => s + (t.max_clients_per_slot || 0), 0);
  const availableSlots = Math.max(0, totalCap - todayUpcoming);

  const hourMap: Record<number, number> = {};
  sessions.forEach(s => {
    if (s.start_time) {
      const h = parseInt(s.start_time.split(":")[0]);
      hourMap[h] = (hourMap[h] || 0) + 1;
    }
  });
  const peakHours: HourBucket[] = Object.entries(hourMap)
    .map(([h, c]) => ({ hour: Number(h), count: c }))
    .sort((a, b) => a.hour - b.hour);

  const alerts: { text: string; severity: "high" | "medium" }[] = [];
  active.forEach(t => {
    if (leaveIds.has(t.id) && alerts.length < 2) {
      const affected = sessions.filter(s => s.trainer_id === t.id).length;
      if (affected > 0) {
        alerts.push({
          text: `${t.first_name} ${t.last_name} on leave today — ${affected} session${affected > 1 ? "s" : ""} affected`,
          severity: "high",
        });
      }
    }
  });
  if (flagged.length > 0 && alerts.length < 3) {
    alerts.push({
      text: `${flagged.length} flagged feedback item${flagged.length > 1 ? "s" : ""} need attention`,
      severity: "medium",
    });
  }

  const now = new Date();
  const weekday = now.toLocaleDateString("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" });
  const datePart = now.toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
  const managerName = profile?.first_name ?? "";
  const gymName = gymData?.name ?? "Iron Kingdom";
  const gymBranch = gymData?.branch_name ?? null;

  return (
    <div>
      <div className="px-6 md:px-8 pt-6 pb-5 border-b border-[#2E3129] bg-[#1A1C18]">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-[#E8EBE4] leading-tight">
              {getGreeting()}{managerName ? `, ${managerName}` : ""}.
            </h1>
            <p className="text-[13px] text-[#6B6E67] mt-1">Here&apos;s your PT operation for today.</p>
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[#6B6E67] font-medium">
              <span>{weekday}, {datePart}</span>
              <span className="text-[#2E3129]">·</span>
              <span className="uppercase tracking-wide">{gymName}</span>
              {gymBranch && (
                <>
                  <span className="text-[#2E3129]">·</span>
                  <span className="uppercase tracking-wide">{gymBranch}</span>
                </>
              )}
            </div>
          </div>
          <button className="w-8 h-8 rounded-lg border border-[#2E3129] bg-[#222520] flex items-center justify-center text-[#6B6E67] hover:bg-[#2E3129] transition-colors flex-shrink-0">
            <Bell size={14} />
          </button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Trainers" value={active.length} />
          <KpiCard label="Active PT Clients" value={clientsRaw?.length ?? 0} />
          <KpiCard label="Today's Sessions" value={todayTotal} />
          <KpiCard label="Available PT Slots" value={availableSlots} accent />
        </div>

        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-[#E8EBE4]">PT Peak Hours</h2>
          <p className="text-xs text-[#6B6E67] mt-0.5 mb-5">Sessions scheduled by hour today</p>
          <PeakHoursChart data={peakHours} />
        </div>

        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-[#E8EBE4] mb-4">Today&apos;s Snapshot</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <div className="text-2xl font-bold text-[#E8EBE4] tabular-nums">{todayTotal}</div>
              <div className="text-xs text-[#6B6E67] mt-0.5">Total Sessions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#B9E84A] tabular-nums">{todayCompleted}</div>
              <div className="text-xs text-[#6B6E67] mt-0.5">Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#E8EBE4] tabular-nums">{todayUpcoming}</div>
              <div className="text-xs text-[#6B6E67] mt-0.5">Upcoming</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#E8EBE4] tabular-nums">{availableSlots}</div>
              <div className="text-xs text-[#6B6E67] mt-0.5">Available Slots</div>
            </div>
          </div>
        </div>

        <div>
          <div className="text-[10px] font-semibold text-[#6B6E67] tracking-widest uppercase mb-3">Quick Actions</div>
          <div className="flex flex-wrap gap-2">
            <Link href="/manager/trainers/new" className="inline-flex items-center gap-1.5 h-9 px-4 bg-[#B9E84A] text-[#171917] text-xs font-semibold rounded-lg hover:bg-[#A8D63A] transition-colors">
              <Plus size={13} /> Add Trainer
            </Link>
            <Link href="/manager/clients/new" className="inline-flex items-center gap-1.5 h-9 px-4 bg-[#222520] border border-[#2E3129] text-[#E8EBE4] text-xs font-medium rounded-lg hover:bg-[#1A1C18] transition-colors">
              <Plus size={13} /> Add PT Client
            </Link>
            <Link href="/manager/assignments" className="inline-flex items-center gap-1.5 h-9 px-4 bg-[#222520] border border-[#2E3129] text-[#E8EBE4] text-xs font-medium rounded-lg hover:bg-[#1A1C18] transition-colors">
              <Link2 size={13} /> Assign Client
            </Link>
            <Link href="/manager/schedule" className="inline-flex items-center gap-1.5 h-9 px-4 bg-[#222520] border border-[#2E3129] text-[#E8EBE4] text-xs font-medium rounded-lg hover:bg-[#1A1C18] transition-colors">
              <CalendarDays size={13} /> View Schedule
            </Link>
          </div>
        </div>

        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((item, i) => (
              <div
                key={i}
                className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border text-xs ${
                  item.severity === "high"
                    ? "bg-red-500/10 border-red-500/30 text-red-400"
                    : "bg-orange-500/10 border-orange-500/30 text-orange-400"
                }`}
              >
                <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

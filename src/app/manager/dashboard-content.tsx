"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { ScheduleGrid, type TrainerRow, type ClientSlotInfo } from "@/components/schedule/schedule-grid";
import { SlotAssignDrawer } from "./slot-assign-drawer";
import { SlotDetailDrawer } from "./slot-detail-drawer";
import { Avatar } from "@/components/ui/avatar";
import { AlertTriangle, Plus, CheckCircle, Link2, CalendarDays, UserPlus, Users } from "lucide-react";

interface ClientOption {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  profile_picture_url?: string | null;
}

interface KPIs {
  activeTrainers: number;
  workingToday: number;
  totalSlots: number;
  filledSlots: number;
  freeSlots: number;
  onLeave: number;
}

interface Alert {
  text: string;
  severity: "high" | "medium";
}

interface DashboardContentProps {
  date: string;
  slots: string[];
  gridData: TrainerRow[];
  kpis: KPIs;
  clients: ClientOption[];
  gymId: string;
  userId: string;
  alerts: Alert[];
}

function KpiChip({
  label,
  value,
  accent = false,
  warn = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs ${
        accent
          ? "bg-[#B9E84A]/10 border-[#B9E84A]/40 text-[#B9E84A]"
          : warn
          ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
          : "bg-[#222520] border-[#2E3129] text-[#9B9E96]"
      }`}
    >
      <span className={`text-lg font-bold tabular-nums leading-none ${accent ? "text-[#B9E84A]" : warn ? "text-orange-400" : "text-[#E8EBE4]"}`}>
        {value}
      </span>
      <span className="text-[11px]">{label}</span>
    </div>
  );
}

function formatHour(h: number) {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

export function DashboardContent({
  date,
  slots,
  gridData,
  kpis,
  clients,
  gymId,
  userId,
  alerts,
}: DashboardContentProps) {
  const [assignSlot, setAssignSlot] = useState<{
    trainer: TrainerRow["trainer"];
    time: string;
    available: number;
  } | null>(null);

  const [detailSlot, setDetailSlot] = useState<{
    trainer: TrainerRow["trainer"];
    time: string;
    clients: ClientSlotInfo[];
  } | null>(null);

  const nowHour = new Date().getHours();
  const nowSlotTime = `${String(nowHour).padStart(2, "0")}:00`;

  const availableNow = useMemo(() => {
    const isToday =
      date ===
      new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    if (!isToday) return [];
    return gridData
      .filter((row) => !row.isOnLeave)
      .map((row) => {
        const slot = row.slots.find((s) => s.time === nowSlotTime);
        if (!slot || !slot.isWorking || slot.isBlocked) return null;
        const open = slot.max - slot.current;
        return open > 0
          ? { trainer: row.trainer, open, max: slot.max }
          : null;
      })
      .filter(Boolean) as { trainer: TrainerRow["trainer"]; open: number; max: number }[];
  }, [gridData, nowSlotTime, date]);

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="flex flex-wrap items-center gap-2">
        <KpiChip label="Active Trainers" value={kpis.activeTrainers} />
        <KpiChip label="Working Today" value={kpis.workingToday} />
        <KpiChip label="Total Slots" value={kpis.totalSlots} />
        <KpiChip label="Filled" value={kpis.filledSlots} />
        <KpiChip label="Free" value={kpis.freeSlots} accent />
        {kpis.onLeave > 0 && <KpiChip label="On Leave" value={kpis.onLeave} warn />}
      </div>

      {/* Schedule grid — main viewport */}
      <ScheduleGrid
        date={date}
        slots={slots}
        gridData={gridData}
        navigationBase="/manager"
        onFreeSlotClick={(trainer, time, available) =>
          setAssignSlot({ trainer, time, available })
        }
        onOccupiedSlotClick={(trainer, time, slotClients) =>
          setDetailSlot({ trainer, time, clients: slotClients })
        }
      />

      {/* Available Now */}
      {availableNow.length > 0 && (
        <div className="bg-[#222520] border border-[#B9E84A]/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle size={13} className="text-[#B9E84A]" />
            <h3 className="text-sm font-semibold text-[#E8EBE4]">Available Right Now</h3>
            <span className="text-[10px] text-[#9B9E96]">· {formatHour(nowHour)}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {availableNow.map((item) => (
              <div
                key={item.trainer.id}
                className="flex items-center gap-2.5 bg-[#1A1C18] border border-[#2E3129] rounded-xl px-3 py-2.5"
              >
                <Avatar
                  firstName={item.trainer.first_name}
                  lastName={item.trainer.last_name}
                  src={item.trainer.profile_picture_url}
                  size="xs"
                />
                <div>
                  <div className="text-xs font-medium text-[#E8EBE4]">
                    {item.trainer.first_name} {item.trainer.last_name}
                  </div>
                  <div className="text-[10px] text-[#B9E84A]">
                    {item.open} slot{item.open !== 1 ? "s" : ""} free
                  </div>
                </div>
                <button
                  onClick={() =>
                    setAssignSlot({
                      trainer: item.trainer,
                      time: nowSlotTime,
                      available: item.open,
                    })
                  }
                  className="ml-1 h-7 px-2.5 bg-[#B9E84A]/10 border border-[#B9E84A]/30 text-[#B9E84A] text-[10px] font-semibold rounded-lg hover:bg-[#B9E84A]/20 transition-colors flex items-center gap-1"
                >
                  <Plus size={9} /> Assign
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 pt-1">
        <Link
          href="/manager/trainers/new"
          className="inline-flex items-center gap-1.5 h-9 px-4 bg-[#B9E84A] text-[#171917] text-xs font-semibold rounded-lg hover:bg-[#A8D63A] transition-colors"
        >
          <UserPlus size={12} /> Add Trainer
        </Link>
        <Link
          href="/manager/clients/new"
          className="inline-flex items-center gap-1.5 h-9 px-4 bg-[#222520] border border-[#2E3129] text-[#E8EBE4] text-xs font-medium rounded-lg hover:bg-[#1A1C18] transition-colors"
        >
          <Users size={12} /> Add PT Client
        </Link>
        <Link
          href="/manager/assignments/new"
          className="inline-flex items-center gap-1.5 h-9 px-4 bg-[#222520] border border-[#2E3129] text-[#E8EBE4] text-xs font-medium rounded-lg hover:bg-[#1A1C18] transition-colors"
        >
          <Link2 size={12} /> New Assignment
        </Link>
        <Link
          href="/manager/schedule"
          className="inline-flex items-center gap-1.5 h-9 px-4 bg-[#222520] border border-[#2E3129] text-[#E8EBE4] text-xs font-medium rounded-lg hover:bg-[#1A1C18] transition-colors"
        >
          <CalendarDays size={12} /> Full Schedule
        </Link>
      </div>

      {/* Alerts */}
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
              <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Drawers */}
      {assignSlot && (
        <SlotAssignDrawer
          trainer={assignSlot.trainer}
          date={date}
          time={assignSlot.time}
          available={assignSlot.available}
          clients={clients}
          gymId={gymId}
          userId={userId}
          onClose={() => setAssignSlot(null)}
          onSuccess={() => setAssignSlot(null)}
        />
      )}

      {detailSlot && (
        <SlotDetailDrawer
          trainer={detailSlot.trainer}
          date={date}
          time={detailSlot.time}
          clients={detailSlot.clients}
          gymId={gymId}
          userId={userId}
          onClose={() => setDetailSlot(null)}
          onAssignMore={() => {
            const trainer = detailSlot.trainer;
            const time = detailSlot.time;
            const currentCount = detailSlot.clients.length;
            setDetailSlot(null);
            setAssignSlot({
              trainer,
              time,
              available: Math.max(0, trainer.max_clients_per_slot - currentCount),
            });
          }}
        />
      )}
    </div>
  );
}

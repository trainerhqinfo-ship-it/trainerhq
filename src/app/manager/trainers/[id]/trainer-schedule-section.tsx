"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { SlotAssignDrawer } from "@/app/manager/slot-assign-drawer";
import { SlotDetailDrawer } from "@/app/manager/slot-detail-drawer";
import { formatTime, DAY_NAMES_FULL } from "@/lib/utils";
import type { ClientSlotInfo } from "@/components/schedule/schedule-grid";
import { Calendar } from "lucide-react";

interface TrainerInfo {
  id: string;
  first_name: string;
  last_name: string;
  profile_picture_url: string | null;
  max_clients_per_slot: number;
}

export interface ScheduleSlotItem {
  time: string;
  isWorking: boolean;
  isOnLeave: boolean;
  isBlocked: boolean;
  current: number;
  max: number;
  clientDetails: ClientSlotInfo[];
}

interface ClientOption {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  profile_picture_url?: string | null;
}

interface Props {
  trainer: TrainerInfo;
  date: string;
  slots: ScheduleSlotItem[];
  allClients: ClientOption[];
  gymId: string;
  userId: string;
}

export function TrainerScheduleSection({ trainer, date, slots, allClients, gymId, userId }: Props) {
  const router = useRouter();
  const [assignSlot, setAssignSlot] = useState<{ time: string; available: number } | null>(null);
  const [detailSlot, setDetailSlot] = useState<{ time: string; clients: ClientSlotInfo[] } | null>(null);

  const displayDate = new Date(date + "T00:00:00");
  const dayLabel = displayDate.toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata",
  });

  const onLeave = slots.some(s => s.isOnLeave);
  const workingSlots = slots.filter(s => s.isWorking);
  const filledCount = workingSlots.filter(s => s.current > 0).length;
  const freeCount = workingSlots.filter(s => s.current === 0 && !s.isBlocked).length;

  if (slots.length === 0) {
    return (
      <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2E3129] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#E8EBE4]">Today&apos;s Schedule</h3>
            <p className="text-xs text-[#6B6E67] mt-0.5">{dayLabel}</p>
          </div>
        </div>
        <div className="px-5 py-10 text-center">
          <div className="text-sm text-[#6B6E67]">Not working today</div>
          <div className="text-xs text-[#4A4D47] mt-1">No schedule configured for {dayLabel}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2E3129] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#E8EBE4]">Today&apos;s Schedule</h3>
            <p className="text-xs text-[#6B6E67] mt-0.5 flex items-center gap-1.5">
              <Calendar size={11} />
              {dayLabel}
            </p>
          </div>
          {!onLeave && (
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-[#B9E84A] font-medium">{freeCount} free</span>
              <span className="text-[#9B9E96]">·</span>
              <span className="text-[#9B9E96]">{filledCount} booked</span>
            </div>
          )}
        </div>

        {onLeave && (
          <div className="mx-5 my-3 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <p className="text-xs font-medium text-amber-400">On Leave Today</p>
          </div>
        )}

        <div className="divide-y divide-[#1A1C18]">
          {slots.map(slot => {
            const isFull = slot.current >= slot.max;
            const isEmpty = slot.current === 0;

            if (!slot.isWorking) {
              return (
                <div key={slot.time} className="flex items-center gap-4 px-5 py-2.5 opacity-30">
                  <span className="text-xs font-mono text-[#6B6E67] w-20 flex-shrink-0">{formatTime(slot.time)}</span>
                  <span className="text-xs text-[#4A4D47]">—</span>
                </div>
              );
            }

            if (slot.isOnLeave) {
              return (
                <div key={slot.time} className="flex items-center gap-4 px-5 py-2.5">
                  <span className="text-xs font-mono text-[#9B9E96] w-20 flex-shrink-0">{formatTime(slot.time)}</span>
                  <span className="text-xs px-2 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded-full">On Leave</span>
                </div>
              );
            }

            if (slot.isBlocked) {
              return (
                <div key={slot.time} className="flex items-center gap-4 px-5 py-2.5">
                  <span className="text-xs font-mono text-[#9B9E96] w-20 flex-shrink-0">{formatTime(slot.time)}</span>
                  <span className="text-xs px-2 py-0.5 bg-[#2E3129] text-[#6B6E67] border border-[#3A3D39] rounded-full">Blocked</span>
                </div>
              );
            }

            if (isEmpty) {
              return (
                <button
                  key={slot.time}
                  type="button"
                  onClick={() => setAssignSlot({ time: slot.time, available: slot.max })}
                  className="w-full flex items-center gap-4 px-5 py-2.5 hover:bg-[#B9E84A]/5 transition-colors group text-left"
                >
                  <span className="text-xs font-mono text-[#9B9E96] w-20 flex-shrink-0 group-hover:text-[#E8EBE4] transition-colors">{formatTime(slot.time)}</span>
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#B9E84A]/60 group-hover:bg-[#B9E84A] transition-colors" />
                    <span className="text-xs text-[#4A4D47] group-hover:text-[#B9E84A] transition-colors">Free · click to assign</span>
                  </div>
                  <span className="text-[10px] text-[#4A4D47] group-hover:text-[#B9E84A]/70 transition-colors">
                    {slot.max} slots
                  </span>
                </button>
              );
            }

            return (
              <button
                key={slot.time}
                type="button"
                onClick={() => setDetailSlot({ time: slot.time, clients: slot.clientDetails })}
                className="w-full flex items-center gap-4 px-5 py-2.5 hover:bg-[#2E3129]/40 transition-colors text-left"
              >
                <span className="text-xs font-mono text-[#E8EBE4] font-medium w-20 flex-shrink-0">{formatTime(slot.time)}</span>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isFull ? "bg-red-400" : "bg-amber-400"}`} />
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    {slot.clientDetails.map(c => (
                      <div key={c.id} className="flex items-center gap-1">
                        <Avatar
                          firstName={c.first_name}
                          lastName={c.last_name}
                          src={c.profile_picture_url ?? null}
                          size="xs"
                        />
                        <span className="text-xs text-[#E8EBE4]">{c.first_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 ${
                  isFull
                    ? "bg-red-500/10 text-red-400 border-red-500/30"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                }`}>
                  {slot.current}/{slot.max}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {assignSlot && (
        <SlotAssignDrawer
          trainer={trainer}
          date={date}
          time={assignSlot.time}
          available={assignSlot.available}
          clients={allClients}
          gymId={gymId}
          userId={userId}
          onClose={() => setAssignSlot(null)}
          onSuccess={() => { setAssignSlot(null); router.refresh(); }}
        />
      )}

      {detailSlot && (
        <SlotDetailDrawer
          trainer={trainer}
          date={date}
          time={detailSlot.time}
          clients={detailSlot.clients}
          gymId={gymId}
          userId={userId}
          onClose={() => setDetailSlot(null)}
          onAssignMore={() => {
            const time = detailSlot.time;
            const currentCount = detailSlot.clients.length;
            setDetailSlot(null);
            setAssignSlot({ time, available: Math.max(0, trainer.max_clients_per_slot - currentCount) });
          }}
        />
      )}
    </>
  );
}

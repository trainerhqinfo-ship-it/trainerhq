"use client";
import { useState } from "react";
import {
  ScheduleGrid,
  type TrainerRow,
  type ClientSlotInfo,
} from "@/components/schedule/schedule-grid";
import { SlotAssignDrawer } from "../slot-assign-drawer";
import { SlotDetailDrawer } from "../slot-detail-drawer";

interface ClientOption {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  profile_picture_url?: string | null;
}

interface ScheduleContentProps {
  date: string;
  slots: string[];
  gridData: TrainerRow[];
  clients: ClientOption[];
  gymId: string;
  userId: string;
}

export function ScheduleContent({
  date,
  slots,
  gridData,
  clients,
  gymId,
  userId,
}: ScheduleContentProps) {
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

  return (
    <div>
      <ScheduleGrid
        date={date}
        slots={slots}
        gridData={gridData}
        navigationBase="/manager/schedule"
        onFreeSlotClick={(trainer, time, available) =>
          setAssignSlot({ trainer, time, available })
        }
        onOccupiedSlotClick={(trainer, time, slotClients) =>
          setDetailSlot({ trainer, time, clients: slotClients })
        }
      />

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

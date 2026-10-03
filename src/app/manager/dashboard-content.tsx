"use client";
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { ScheduleGrid, type TrainerRow, type ClientSlotInfo } from "@/components/schedule/schedule-grid";
import { SlotAssignDrawer } from "./slot-assign-drawer";
import { SlotDetailDrawer } from "./slot-detail-drawer";
import { Avatar } from "@/components/ui/avatar";
import { Dialog } from "@/components/ui/dialog";
import { AlertTriangle, Plus, CheckCircle, Link2, CalendarDays, UserPlus, Users, RefreshCw, Eye, ChevronRight } from "lucide-react";
import type { ExpiryEntry } from "./expiry-types";

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
  expiryData: ExpiryEntry[];
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

function statusLabel(status: ExpiryEntry["status"], days: number) {
  if (status === "expired") return `${Math.abs(days)}d overdue`;
  if (status === "today") return "Expires today";
  return `${days}d left`;
}

function ExpiryRow({ entry, onClose }: { entry: ExpiryEntry; onClose: () => void }) {
  const isExpired = entry.status === "expired";
  return (
    <div className={`rounded-xl border p-3.5 ${isExpired ? "bg-red-500/5 border-red-500/20" : "bg-orange-500/5 border-orange-500/20"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[#E8EBE4] truncate">{entry.clientName}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isExpired ? "bg-red-500/15 text-red-400" : "bg-orange-500/15 text-orange-400"
            }`}>
              {statusLabel(entry.status, entry.daysUntilExpiry)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-[#6B6E67]">
            {entry.clientPhone && <span>{entry.clientPhone}</span>}
            {entry.trainerName && <span>Trainer: {entry.trainerName}</span>}
            {entry.packageName && <span>{entry.packageName}</span>}
            {entry.startDate && <span>{entry.startDate} → {entry.endDate}</span>}
            {entry.amountCollected != null && (
              <span>₹{entry.amountCollected.toLocaleString("en-IN")}</span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex gap-2">
        <Link
          href={`/manager/clients/${entry.clientId}`}
          onClick={onClose}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-[#2E3129] text-[11px] text-[#9B9E96] hover:bg-[#1A1C18] transition-colors"
        >
          <Eye size={10} /> View Client
        </Link>
        <Link
          href={`/manager/clients/${entry.clientId}/packages/new`}
          onClick={onClose}
          className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-colors ${
            isExpired
              ? "bg-[#B9E84A] text-[#171917] hover:bg-[#A8D63A]"
              : "bg-orange-500/10 border border-orange-500/30 text-orange-400 hover:bg-orange-500/20"
          }`}
        >
          <RefreshCw size={10} /> Renew Package
        </Link>
      </div>
    </div>
  );
}

function ExpiryAlertDialog({ expiryData }: { expiryData: ExpiryEntry[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (expiryData.length === 0) return;
    try {
      const dismissed = sessionStorage.getItem("expiry-alert-dismissed");
      if (!dismissed) setOpen(true);
    } catch {
      // sessionStorage not available (private browsing etc.)
    }
  }, [expiryData.length]);

  function handleClose() {
    setOpen(false);
    try { sessionStorage.setItem("expiry-alert-dismissed", "1"); } catch {}
  }

  const expired = expiryData.filter((e) => e.status === "expired");
  const today = expiryData.filter((e) => e.status === "today");
  const sevenDays = expiryData.filter((e) => e.status === "7days");
  const thirtyDays = expiryData.filter((e) => e.status === "30days");

  const summaryParts = [
    expired.length > 0 && `${expired.length} Expired`,
    today.length + sevenDays.length > 0 && `${today.length + sevenDays.length} Due in 7 Days`,
    thirtyDays.length > 0 && `${thirtyDays.length} Due in 30 Days`,
  ].filter(Boolean);

  const dialogTitle = expired.length > 0
    ? `PT Packages Expired`
    : `PT Packages Expiring Soon`;
  const dialogDesc = expired.length > 0
    ? `${expired.length} client${expired.length !== 1 ? "s have" : " has"} an expired PT package`
    : `${expiryData.length} PT package${expiryData.length !== 1 ? "s are" : " is"} expiring soon`;

  if (expiryData.length === 0) return null;

  return (
    <Dialog open={open} onClose={handleClose} title={dialogTitle} description={dialogDesc} size="lg">
      <div className="space-y-4">
        {/* Summary chips */}
        {summaryParts.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {summaryParts.map((part, i) => (
              <span key={i} className={`text-[11px] font-semibold px-3 py-1 rounded-full border ${
                i === 0 && expired.length > 0 ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-orange-500/10 text-orange-400 border-orange-500/20"
              }`}>
                {part}
              </span>
            ))}
          </div>
        )}

        {/* Expired clients — show up to 5 */}
        {expired.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">Expired</div>
            {expired.slice(0, 5).map((entry) => (
              <ExpiryRow key={entry.clientId} entry={entry} onClose={handleClose} />
            ))}
            {expired.length > 5 && (
              <p className="text-xs text-[#6B6E67] text-center pt-1">
                +{expired.length - 5} more expired — see all on the renewals page
              </p>
            )}
          </div>
        )}

        {/* Upcoming — show first 3 */}
        {(today.length + sevenDays.length + thirtyDays.length > 0) && (
          <div className="space-y-2">
            <div className="text-[10px] font-semibold text-orange-400 uppercase tracking-wider">Expiring Soon</div>
            {[...today, ...sevenDays, ...thirtyDays].slice(0, 3).map((entry) => (
              <ExpiryRow key={entry.clientId} entry={entry} onClose={handleClose} />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-[#2E3129]">
          <Link
            href="/manager/renewals"
            onClick={handleClose}
            className="inline-flex items-center gap-1 text-xs text-[#B9E84A] hover:underline font-medium"
          >
            View All Renewals <ChevronRight size={12} />
          </Link>
          <button
            onClick={handleClose}
            className="h-8 px-4 rounded-lg border border-[#2E3129] text-xs text-[#9B9E96] hover:bg-[#1A1C18] transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </Dialog>
  );
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
  expiryData,
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

  const expiredCount = expiryData.filter((e) => e.status === "expired").length;
  const soonCount = expiryData.filter((e) => e.status !== "expired").length;

  return (
    <div className="space-y-5">
      {/* Expiry alert popup */}
      <ExpiryAlertDialog expiryData={expiryData} />

      {/* KPI strip */}
      <div className="flex flex-wrap items-center gap-2">
        <KpiChip label="Active Trainers" value={kpis.activeTrainers} />
        <KpiChip label="Working Today" value={kpis.workingToday} />
        <KpiChip label="Total Slots" value={kpis.totalSlots} />
        <KpiChip label="Filled" value={kpis.filledSlots} />
        <KpiChip label="Free" value={kpis.freeSlots} accent />
        {kpis.onLeave > 0 && <KpiChip label="On Leave" value={kpis.onLeave} warn />}
      </div>

      {/* Persistent expiry banner (shows even after dialog dismissed) */}
      {expiryData.length > 0 && (
        <Link
          href="/manager/renewals"
          className="flex items-center justify-between px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-colors group"
        >
          <div className="flex items-center gap-2.5 text-xs">
            <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
            <span className="text-[#E8EBE4]">
              {expiredCount > 0 && (
                <><span className="font-semibold text-red-400">{expiredCount} expired</span>{" "}</>
              )}
              {expiredCount > 0 && soonCount > 0 && "· "}
              {soonCount > 0 && (
                <><span className="text-orange-400">{soonCount} expiring soon</span>{" "}</>
              )}
              <span className="text-[#6B6E67]">— PT packages</span>
            </span>
          </div>
          <span className="text-[10px] text-[#B9E84A] font-semibold group-hover:underline">
            View Renewals →
          </span>
        </Link>
      )}

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

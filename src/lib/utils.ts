import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function getCapacityColor(current: number, max: number): string {
  const ratio = current / max;
  if (ratio >= 1) return "capacity-full";
  if (ratio >= 0.6) return "capacity-partial";
  return "capacity-available";
}

export function getCapacityBgColor(current: number, max: number): string {
  const ratio = current / max;
  if (ratio >= 1) return "bg-red-100 text-red-700 border-red-200";
  if (ratio >= 0.6) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-[#C7F14A]/15 text-[#5A7A0A] border-[#C7F14A]/30";
}

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_NAMES_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function getDayName(dayOfWeek: number, full = false): string {
  return full ? DAY_NAMES_FULL[dayOfWeek] : DAY_NAMES[dayOfWeek];
}

export const SPECIALIZATIONS = [
  "Weight Loss",
  "Muscle Building",
  "Strength Training",
  "Functional Training",
  "Bodybuilding",
  "General Fitness",
  "Sports Conditioning",
  "Senior Fitness",
  "Pre/Post Natal",
  "Rehabilitation",
  "HIIT",
  "Yoga",
  "Pilates",
  "CrossFit",
  "Powerlifting",
];

export const GOALS = [
  "Weight Loss",
  "Muscle Building",
  "Strength Training",
  "General Fitness",
  "Bodybuilding",
  "Functional Training",
  "Sports Conditioning",
  "Senior Fitness",
  "Rehabilitation",
  "Endurance",
];

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: "Active",
    on_leave: "On Leave",
    inactive: "Inactive",
    scheduled: "Scheduled",
    completed: "Completed",
    cancelled: "Cancelled",
    no_show: "No Show",
    rescheduled: "Rescheduled",
    draft: "Draft",
    reviewed: "Reviewed",
    approved: "Approved",
    paid: "Paid",
    paused: "Paused",
    expired: "Expired",
  };
  return labels[status] || status;
}

export function generateTimeSlots(
  startTime: string,
  endTime: string,
  slotDuration = 60
): string[] {
  const slots: string[] = [];
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);

  let current = startHour * 60 + startMin;
  const end = endHour * 60 + endMin;

  while (current + slotDuration <= end) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    current += slotDuration;
  }

  return slots;
}

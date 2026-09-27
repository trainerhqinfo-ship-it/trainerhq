import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "active" | "leave" | "inactive" | "success" | "warning" | "danger" | "outline";
  className?: string;
}

const variants = {
  default: "bg-[#2E3129] text-[#6B6E67] border-[#2E3129]",
  active: "bg-[#B9E84A]/15 text-[#B9E84A] border-[#B9E84A]/30",
  leave: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  inactive: "bg-[#2E3129] text-[#6B6E67] border-[#2E3129]",
  success: "bg-[#B9E84A]/15 text-[#B9E84A] border-[#B9E84A]/30",
  warning: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  danger: "bg-red-500/15 text-red-400 border-red-500/30",
  outline: "bg-transparent text-[#6B6E67] border-[#2E3129]",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
    active: { label: "Active", variant: "active" },
    on_leave: { label: "On Leave", variant: "leave" },
    inactive: { label: "Inactive", variant: "inactive" },
    scheduled: { label: "Scheduled", variant: "outline" },
    completed: { label: "Completed", variant: "success" },
    cancelled: { label: "Cancelled", variant: "danger" },
    no_show: { label: "No Show", variant: "warning" },
    draft: { label: "Draft", variant: "outline" },
    reviewed: { label: "Reviewed", variant: "warning" },
    approved: { label: "Approved", variant: "success" },
    paid: { label: "Paid", variant: "active" },
    paused: { label: "Paused", variant: "warning" },
    expired: { label: "Expired", variant: "inactive" },
  };

  const { label, variant } = config[status] || { label: status, variant: "default" as const };

  return <Badge variant={variant}>{label}</Badge>;
}

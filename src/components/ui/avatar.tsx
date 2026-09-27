"use client";
import { cn, getInitials } from "@/lib/utils";

interface AvatarProps {
  src?: string | null;
  firstName: string;
  lastName: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizes = {
  xs: "w-6 h-6 text-[9px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
  xl: "w-16 h-16 text-lg",
};

const bgColors = [
  "bg-blue-500/20 text-blue-300",
  "bg-purple-500/20 text-purple-300",
  "bg-orange-500/20 text-orange-300",
  "bg-teal-500/20 text-teal-300",
  "bg-rose-500/20 text-rose-300",
  "bg-indigo-500/20 text-indigo-300",
];

function getColorIndex(name: string): number {
  let hash = 0;
  for (const char of name) hash += char.charCodeAt(0);
  return hash % bgColors.length;
}

export function Avatar({ src, firstName, lastName, size = "md", className }: AvatarProps) {
  const initials = getInitials(firstName, lastName);
  const colorClass = bgColors[getColorIndex(firstName + lastName)];

  if (src) {
    return (
      <img
        src={src}
        alt={`${firstName} ${lastName}`}
        className={cn("rounded-full object-cover flex-shrink-0", sizes[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold flex-shrink-0",
        sizes[size],
        colorClass,
        className
      )}
    >
      {initials}
    </div>
  );
}

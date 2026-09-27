"use client";
import { Bell } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 md:px-8 py-4 md:py-5 border-b border-[#2E3129] bg-[#1A1C18]">
      <div className="min-w-0 mr-4">
        <h1 className="text-xl md:text-2xl font-semibold text-[#E8EBE4] leading-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13px] text-[#6B6E67] mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {actions}
        <button className="w-8 h-8 rounded-lg border border-[#2E3129] bg-[#222520] flex items-center justify-center text-[#6B6E67] hover:bg-[#2E3129] transition-colors">
          <Bell size={14} />
        </button>
      </div>
    </div>
  );
}

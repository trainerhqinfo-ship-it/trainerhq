"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Avatar } from "@/components/ui/avatar";
import { Menu, X } from "lucide-react";

interface ManagerShellProps {
  children: React.ReactNode;
  gymName: string;
  gymBranch?: string;
  userFirstName: string;
  userLastName: string;
}

export function ManagerShell({
  children,
  gymName,
  gymBranch,
  userFirstName,
  userLastName,
}: ManagerShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-40 md:relative md:block md:z-auto
        transform transition-transform duration-200 ease-out
        ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <Sidebar
          gymName={gymName}
          gymBranch={gymBranch}
          userFirstName={userFirstName}
          userLastName={userLastName}
          role="gym_manager"
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#151715] flex-shrink-0 border-b border-white/[0.06]">
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="w-8 h-8 flex items-center justify-center text-[#C8CBC4] hover:text-white transition-colors"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          {/* Center: gym context */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-[#B9E84A] rounded-md flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1" fill="#151715"/>
                <rect x="8" y="1" width="5" height="5" rx="1" fill="#151715"/>
                <rect x="1" y="8" width="5" height="5" rx="1" fill="#151715"/>
                <rect x="8" y="8" width="2" height="5" rx="1" fill="#151715"/>
              </svg>
            </div>
            <div className="text-center">
              <div className="text-white text-xs font-semibold leading-tight">{gymName}</div>
              {gymBranch && (
                <div className="text-[#6B6E67] text-[10px] leading-tight">{gymBranch}</div>
              )}
            </div>
          </div>

          {/* Avatar */}
          <Avatar firstName={userFirstName} lastName={userLastName} size="sm" />
        </div>

        <main className="flex-1 overflow-y-auto bg-[#1A1C18]">{children}</main>
      </div>
    </div>
  );
}

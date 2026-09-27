"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, CalendarDays, Users, UserCheck, Link2,
  Clock, CheckSquare, DollarSign, BarChart3, MessageSquare,
  Settings, TrendingUp, Star, LogOut, ChevronRight,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

interface NavItem  { label: string; href: string; icon: React.ReactNode; }
interface NavGroup { label: string; items: NavItem[]; }

const managerNavGroups: NavGroup[] = [
  {
    label: "WORKSPACE",
    items: [
      { label: "Overview",    href: "/manager",             icon: <LayoutDashboard size={14} /> },
      { label: "Schedule",    href: "/manager/schedule",    icon: <CalendarDays size={14} /> },
      { label: "Trainers",    href: "/manager/trainers",    icon: <Users size={14} /> },
      { label: "PT Clients",  href: "/manager/clients",     icon: <UserCheck size={14} /> },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { label: "Assignments", href: "/manager/assignments", icon: <Link2 size={14} /> },
      { label: "Availability",href: "/manager/availability",icon: <Clock size={14} /> },
      { label: "Sessions",    href: "/manager/sessions",    icon: <CheckSquare size={14} /> },
      { label: "Payouts",     href: "/manager/payouts",     icon: <DollarSign size={14} /> },
    ],
  },
  {
    label: "INSIGHTS",
    items: [
      { label: "Performance", href: "/manager/performance", icon: <BarChart3 size={14} /> },
      { label: "Feedback",    href: "/manager/feedback",    icon: <MessageSquare size={14} /> },
    ],
  },
  {
    label: "SETTINGS",
    items: [
      { label: "Settings",    href: "/manager/settings",    icon: <Settings size={14} /> },
    ],
  },
];

const trainerNavGroups: NavGroup[] = [
  {
    label: "MY WORK",
    items: [
      { label: "My Dashboard", href: "/trainer",            icon: <LayoutDashboard size={14} /> },
      { label: "My Clients",   href: "/trainer/clients",    icon: <UserCheck size={14} /> },
      { label: "My Schedule",  href: "/trainer/schedule",   icon: <CalendarDays size={14} /> },
      { label: "My Sessions",  href: "/trainer/sessions",   icon: <CheckSquare size={14} /> },
    ],
  },
  {
    label: "MY PERFORMANCE",
    items: [
      { label: "My Rating",     href: "/trainer/feedback",    icon: <Star size={14} /> },
      { label: "My Performance",href: "/trainer/performance", icon: <TrendingUp size={14} /> },
    ],
  },
  {
    label: "ACCOUNT",
    items: [
      { label: "My Profile", href: "/trainer/profile",  icon: <Users size={14} /> },
      { label: "Settings",   href: "/trainer/settings", icon: <Settings size={14} /> },
    ],
  },
];

function getMonogram(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join("");
}

interface SidebarProps {
  gymName: string;
  gymBranch?: string;
  userFirstName: string;
  userLastName: string;
  userPhoto?: string;
  role: "gym_manager" | "trainer";
  onLogout?: () => void;
}

export function Sidebar({
  gymName, gymBranch, userFirstName, userLastName, userPhoto, role, onLogout,
}: SidebarProps) {
  const pathname = usePathname();
  const navGroups = role === "gym_manager" ? managerNavGroups : trainerNavGroups;
  const monogram = getMonogram(gymName);

  const isActive = (href: string) => {
    if (href === "/manager" || href === "/trainer") return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-[240px] flex-shrink-0 bg-[#151715] flex flex-col h-full">

      {/* Brand */}
      <div className="px-4 pt-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#B9E84A] rounded-lg flex items-center justify-center flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" fill="#151715"/>
              <rect x="8" y="1" width="5" height="5" rx="1" fill="#151715"/>
              <rect x="1" y="8" width="5" height="5" rx="1" fill="#151715"/>
              <rect x="8" y="8" width="2" height="5" rx="1" fill="#151715"/>
              <rect x="11" y="8" width="2" height="2" rx="0.5" fill="#151715"/>
            </svg>
          </div>
          <span className="text-white font-semibold text-sm tracking-tight">TrainerHQ</span>
        </div>
      </div>

      {/* Gym workspace */}
      <div className="px-3 py-3 border-b border-white/[0.06]">
        <button className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.05] transition-colors group text-left">
          {/* Gym monogram */}
          <div className="w-7 h-7 rounded-md bg-white/10 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-[#B9E84A] tracking-wider">{monogram}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-white truncate leading-tight">{gymName}</div>
            {gymBranch && (
              <div className="text-[10px] text-[#6B6E67] truncate leading-tight mt-0.5">{gymBranch}</div>
            )}
          </div>
          <ChevronRight size={11} className="text-[#4A4D47] flex-shrink-0" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 scrollbar-thin space-y-5">
        {navGroups.map((group, gi) => (
          <div key={gi}>
            <div className="px-2 mb-2">
              <span className="text-[10px] font-semibold text-[#3D4039] tracking-widest">
                {group.label}
              </span>
            </div>
            <div className="space-y-0.5">
              {group.items.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn("nav-item", isActive(item.href) && "active")}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-white/[0.06] space-y-1">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.05] cursor-pointer transition-colors">
          <Avatar firstName={userFirstName} lastName={userLastName} src={userPhoto} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-[#C8CBC4] truncate leading-tight">
              {userFirstName} {userLastName}
            </div>
            <div className="text-[10px] text-[#4A4D47] leading-tight mt-0.5 capitalize">
              {role === "gym_manager" ? "Manager" : "Trainer"}
            </div>
          </div>
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[#4A4D47] hover:text-red-400 hover:bg-white/[0.05] transition-colors text-xs"
          >
            <LogOut size={12} />
            Log out
          </button>
        )}
      </div>
    </aside>
  );
}
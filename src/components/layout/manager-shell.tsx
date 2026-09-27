"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Sidebar } from "./sidebar";
import { Avatar } from "@/components/ui/avatar";
import { Menu, X } from "lucide-react";

interface ManagerShellProps {
  children: React.ReactNode;
  userId: string;
}

function getMonogram(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

export function ManagerShell({ children, userId }: ManagerShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [gym, setGym] = useState({ name: "Iron Kingdom", branch_name: null as string | null });
  const [user, setUser] = useState({ first_name: "Manager", last_name: "" });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    async function loadGymData() {
      const supabase = createClient();
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, role, gym_id")
        .eq("id", userId)
        .single();

      if (!profile) return;
      if (profile.role !== "gym_manager") {
        router.push("/trainer");
        return;
      }

      setUser({ first_name: profile.first_name ?? "Manager", last_name: profile.last_name ?? "" });

      if (profile.gym_id) {
        const { data: gymData } = await supabase
          .from("gyms")
          .select("name, branch_name")
          .eq("id", profile.gym_id)
          .single();
        if (gymData) setGym(gymData);
      }
    }
    loadGymData();
  }, [userId, router]);

  const monogram = getMonogram(gym.name);

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
          gymName={gym.name}
          gymBranch={gym.branch_name ?? undefined}
          userFirstName={user.first_name}
          userLastName={user.last_name}
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
              <div className="text-white text-xs font-semibold leading-tight">{gym.name}</div>
              {gym.branch_name && (
                <div className="text-[#6B6E67] text-[10px] leading-tight">{gym.branch_name}</div>
              )}
            </div>
          </div>

          {/* Avatar */}
          <Avatar firstName={user.first_name} lastName={user.last_name} size="sm" />
        </div>

        <main className="flex-1 overflow-y-auto bg-[#1A1C18]">{children}</main>
      </div>
    </div>
  );
}
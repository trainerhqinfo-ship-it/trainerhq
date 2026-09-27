"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Sidebar } from "@/components/layout/sidebar";
import { Avatar } from "@/components/ui/avatar";
import { Menu, User, Star, Settings, LogOut } from "lucide-react";
import Link from "next/link";

export default function TrainerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const avatarRef = useRef<HTMLDivElement>(null);

  const [gym, setGym] = useState({ name: "Iron Kingdom", branch_name: null as string | null });
  const [user, setUser] = useState({ first_name: "Trainer", last_name: "", photo: "" });
  const [checked, setChecked] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

  // Close drawers on navigation
  useEffect(() => { setMobileOpen(false); setAvatarOpen(false); }, [pathname]);

  // Close avatar dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push("/login"); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, role, gym_id")
        .eq("id", authUser.id)
        .single();

      if (!profile) { router.push("/login"); return; }
      if (profile.role !== "trainer") { router.push("/manager"); return; }

      const { data: trainerData } = await supabase
        .from("trainers")
        .select("profile_picture_url")
        .eq("user_id", authUser.id)
        .single();

      setUser({
        first_name: profile.first_name ?? "Trainer",
        last_name: profile.last_name ?? "",
        photo: trainerData?.profile_picture_url ?? "",
      });

      if (profile.gym_id) {
        const { data: gymData } = await supabase.from("gyms").select("name, branch_name").eq("id", profile.gym_id).single();
        if (gymData) setGym(gymData);
      }
      setChecked(true);
    }
    loadData();
  }, [router]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (!checked) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1A1C18]">
        <div className="text-sm text-[#6B6E67]">Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — hidden on mobile unless hamburger is open */}
      <div className={`
        fixed inset-y-0 left-0 z-40 md:relative md:block md:z-auto
        transform transition-transform duration-200
        ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <Sidebar
          gymName={gym.name}
          gymBranch={gym.branch_name ?? undefined}
          userFirstName={user.first_name}
          userLastName={user.last_name}
          userPhoto={user.photo}
          role="trainer"
          onLogout={handleLogout}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar: ☰ | TrainerHQ | Avatar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#151715] flex-shrink-0 border-b border-white/[0.06]">
          {/* Hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="w-9 h-9 flex items-center justify-center text-[#C8CBC4] hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-[#B9E84A] rounded-md flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1" fill="#151715"/>
                <rect x="8" y="1" width="5" height="5" rx="1" fill="#151715"/>
                <rect x="1" y="8" width="5" height="5" rx="1" fill="#151715"/>
                <rect x="8" y="8" width="2" height="5" rx="1" fill="#151715"/>
              </svg>
            </div>
            <span className="text-white text-sm font-semibold">TrainerHQ</span>
          </div>

          {/* Profile avatar button */}
          <div className="relative" ref={avatarRef}>
            <button
              onClick={() => setAvatarOpen(v => !v)}
              className="w-9 h-9 rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#B9E84A] focus:ring-offset-1 focus:ring-offset-[#151715]"
              aria-label="Open profile menu"
            >
              <Avatar
                firstName={user.first_name}
                lastName={user.last_name}
                src={user.photo || undefined}
                size="sm"
              />
            </button>

            {/* Avatar dropdown */}
            {avatarOpen && (
              <div className="absolute right-0 top-11 w-56 bg-[#222520] rounded-2xl shadow-2xl border border-[#2E3129] py-1 z-50">
                {/* Trainer info */}
                <div className="px-4 py-3 border-b border-[#2E3129]">
                  <div className="flex items-center gap-3">
                    <Avatar firstName={user.first_name} lastName={user.last_name} src={user.photo || undefined} size="md" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#E8EBE4] truncate">{user.first_name} {user.last_name}</div>
                      <div className="text-xs text-[#6B6E67]">Personal Trainer</div>
                    </div>
                  </div>
                </div>
                {/* Links */}
                <div className="py-1">
                  <Link href="/trainer/profile" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#E8EBE4] hover:bg-[#2E3129] transition-colors">
                    <User size={14} className="text-[#6B6E67] flex-shrink-0" />
                    View Profile
                  </Link>
                  <Link href="/trainer/feedback" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#E8EBE4] hover:bg-[#2E3129] transition-colors">
                    <Star size={14} className="text-[#6B6E67] flex-shrink-0" />
                    My Rating
                  </Link>
                  <Link href="/trainer/settings" className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#E8EBE4] hover:bg-[#2E3129] transition-colors">
                    <Settings size={14} className="text-[#6B6E67] flex-shrink-0" />
                    Settings
                  </Link>
                </div>
                <div className="border-t border-[#2E3129] py-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-[#2E3129] transition-colors"
                  >
                    <LogOut size={14} className="flex-shrink-0" />
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <main className="flex-1 overflow-y-auto bg-[#1A1C18]">{children}</main>
      </div>
    </div>
  );
}
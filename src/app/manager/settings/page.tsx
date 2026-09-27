"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [gym, setGym] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      setUser(authUser);
      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", authUser.id).single();
      const { data: gymData } = await supabase.from("gyms").select("*").eq("id", profileData?.gym_id!).single();
      setProfile(profileData);
      setGym(gymData);
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) return <div className="p-8 text-sm text-[#6B6E67]">Loading...</div>;

  return (
    <div>
      <Header title="Settings" subtitle="Gym and account settings" />

      <div className="px-8 py-6 max-w-2xl space-y-5">
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#E8EBE4]">Gym Profile</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              { label: "Gym Name", value: gym?.name },
              { label: "Branch", value: gym?.branch_name ?? "—" },
              { label: "City", value: gym?.city ?? "—" },
              { label: "Phone", value: gym?.phone ?? "—" },
              { label: "Email", value: gym?.email ?? "—" },
              { label: "Timezone", value: gym?.timezone ?? "Asia/Kolkata" },
              { label: "Default Slot", value: `${gym?.default_slot_duration ?? 60} min` },
              { label: "Status", value: gym?.status ?? "active" },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-xs text-[#6B6E67]">{label}</div>
                <div className="font-medium text-[#E8EBE4] mt-0.5 capitalize">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#E8EBE4]">Account</h2>
          <div className="text-sm">
            <div className="text-xs text-[#6B6E67]">Email</div>
            <div className="font-medium text-[#E8EBE4] mt-0.5">{profile?.email ?? user?.email}</div>
          </div>
          <div className="text-sm">
            <div className="text-xs text-[#6B6E67]">Role</div>
            <div className="font-medium text-[#E8EBE4] mt-0.5 capitalize">{profile?.role?.replace("_", " ")}</div>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="h-8 px-4 rounded-lg text-xs font-medium text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

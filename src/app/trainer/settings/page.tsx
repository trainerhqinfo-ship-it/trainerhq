"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Lock, ChevronRight, LogOut, Eye, EyeOff } from "lucide-react";

export default function TrainerSettingsPage() {
  const router = useRouter();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    setPwSuccess(false);
    if (newPw !== confirmPw) { setPwError("New passwords do not match."); return; }
    if (newPw.length < 8) { setPwError("Password must be at least 8 characters."); return; }

    setSaving(true);
    const supabase = createClient();

    // Re-authenticate with current password first
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { setPwError("Session expired. Please log in again."); setSaving(false); return; }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPw,
    });
    if (signInError) { setPwError("Current password is incorrect."); setSaving(false); return; }

    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) { setPwError(error.message); setSaving(false); return; }

    setPwSuccess(true);
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
    setSaving(false);
    setTimeout(() => { setShowPasswordForm(false); setPwSuccess(false); }, 2000);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div>
      <Header title="Settings" />
      <div className="px-4 md:px-8 py-6 space-y-5 max-w-lg">

        {/* Account section */}
        <div>
          <div className="text-[10px] font-semibold text-[#6B6E67] uppercase tracking-widest px-1 mb-2">Account</div>
          <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
            <button
              onClick={() => { setShowPasswordForm(v => !v); setPwError(""); setPwSuccess(false); }}
              className="w-full flex items-center justify-between px-4 py-4 hover:bg-[#1A1C18] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#E8EBE4] flex items-center justify-center text-[#B9E84A]">
                  <Lock size={14} />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-[#E8EBE4]">Change Password</div>
                  <div className="text-xs text-[#6B6E67]">Update your account password</div>
                </div>
              </div>
              <ChevronRight size={16} className={`text-[#D5D7D0] transition-transform ${showPasswordForm ? "rotate-90" : ""}`} />
            </button>

            {showPasswordForm && (
              <div className="border-t border-[#1A1C18] px-4 py-4">
                {pwSuccess ? (
                  <div className="text-sm text-[#B9E84A] bg-[#B9E84A]/10 border border-[#B9E84A]/30 rounded-xl px-4 py-3">
                    Password updated successfully.
                  </div>
                ) : (
                  <form onSubmit={handleChangePassword} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-[#E8EBE4] mb-1.5">Current Password</label>
                      <div className="relative">
                        <input
                          type={showCurrent ? "text" : "password"}
                          value={currentPw}
                          onChange={e => setCurrentPw(e.target.value)}
                          required
                          autoComplete="current-password"
                          className="w-full px-3 py-2.5 pr-10 text-sm border border-[#D5D7D0] rounded-lg bg-[#222520] focus:outline-none focus:ring-2 focus:ring-[#B9E84A]/50 focus:border-[#B9E84A] text-[#E8EBE4]"
                        />
                        <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6E67]">
                          {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#E8EBE4] mb-1.5">New Password</label>
                      <div className="relative">
                        <input
                          type={showNew ? "text" : "password"}
                          value={newPw}
                          onChange={e => setNewPw(e.target.value)}
                          required
                          minLength={8}
                          autoComplete="new-password"
                          placeholder="At least 8 characters"
                          className="w-full px-3 py-2.5 pr-10 text-sm border border-[#D5D7D0] rounded-lg bg-[#222520] focus:outline-none focus:ring-2 focus:ring-[#B9E84A]/50 focus:border-[#B9E84A] text-[#E8EBE4] placeholder-[#9B9E96]"
                        />
                        <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B6E67]">
                          {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#E8EBE4] mb-1.5">Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPw}
                        onChange={e => setConfirmPw(e.target.value)}
                        required
                        autoComplete="new-password"
                        className="w-full px-3 py-2.5 text-sm border border-[#D5D7D0] rounded-lg bg-[#222520] focus:outline-none focus:ring-2 focus:ring-[#B9E84A]/50 focus:border-[#B9E84A] text-[#E8EBE4]"
                      />
                    </div>
                    {pwError && (
                      <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{pwError}</div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button type="button" onClick={() => { setShowPasswordForm(false); setPwError(""); }} className="flex-1 py-2.5 text-sm border border-[#2E3129] rounded-xl text-[#6B6E67] hover:bg-[#1A1C18] transition-colors">
                        Cancel
                      </button>
                      <button type="submit" disabled={saving} className="flex-1 py-2.5 text-sm bg-[#B9E84A] hover:bg-[#B8E23B] disabled:opacity-60 rounded-xl font-semibold text-[#171917] transition-colors">
                        {saving ? "Updating..." : "Update Password"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

        {/* PT Settings - view only */}
        <div>
          <div className="text-[10px] font-semibold text-[#6B6E67] uppercase tracking-widest px-1 mb-2">PT Configuration</div>
          <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-4">
            <p className="text-xs text-[#6B6E67]">
              Your session capacity, working hours, and commission rates are configured by your gym manager.
              Contact your manager to request any changes.
            </p>
          </div>
        </div>

        {/* Logout */}
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-4 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
              <LogOut size={14} className="text-red-500" />
            </div>
            <div className="text-left">
              <div className="text-sm font-medium">Log Out</div>
              <div className="text-xs text-red-400">Sign out of TrainerHQ</div>
            </div>
          </button>
        </div>

      </div>
    </div>
  );
}
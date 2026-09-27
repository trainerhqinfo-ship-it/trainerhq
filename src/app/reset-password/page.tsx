"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase puts the token in the URL hash; the client library handles it automatically
    const supabase = createClient();
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) { setError(err.message); setLoading(false); return; }
    router.push("/login?reset=1");
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#1A1C18] flex items-center justify-center">
        <div className="text-sm text-[#6B6E67]">Verifying reset link…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1A1C18] flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-7 h-7 bg-[#B9E84A] rounded-md flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" fill="#E8EBE4"/>
              <rect x="8" y="1" width="5" height="5" rx="1" fill="#E8EBE4"/>
              <rect x="1" y="8" width="5" height="5" rx="1" fill="#E8EBE4"/>
              <rect x="8" y="8" width="2" height="5" rx="1" fill="#E8EBE4"/>
            </svg>
          </div>
          <span className="font-semibold text-[#E8EBE4]">TrainerHQ</span>
        </div>

        <h1 className="text-xl font-semibold text-[#E8EBE4] mb-1">Set new password</h1>
        <p className="text-sm text-[#6B6E67] mb-6">Choose a new password for your account.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#E8EBE4] mb-1.5">New password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full px-3 py-2.5 text-sm border border-[#D5D7D0] rounded-lg bg-[#222520] focus:outline-none focus:ring-2 focus:ring-[#B9E84A]/50 focus:border-[#B9E84A] text-[#E8EBE4] placeholder-[#9B9E96]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#E8EBE4] mb-1.5">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repeat new password"
              required
              autoComplete="new-password"
              className="w-full px-3 py-2.5 text-sm border border-[#D5D7D0] rounded-lg bg-[#222520] focus:outline-none focus:ring-2 focus:ring-[#B9E84A]/50 focus:border-[#B9E84A] text-[#E8EBE4] placeholder-[#9B9E96]"
            />
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#B9E84A] hover:bg-[#B8E23B] disabled:opacity-60 text-[#171917] font-semibold text-sm py-3 rounded-xl transition-colors"
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
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

        {sent ? (
          <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-6 text-center">
            <div className="w-10 h-10 bg-[#B9E84A]/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B9E84A" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-[#E8EBE4] mb-1">Check your email</h2>
            <p className="text-xs text-[#6B6E67] mb-4">
              We sent a password reset link to <strong>{email}</strong>.
            </p>
            <Link href="/login" className="text-xs text-[#6B6E67] hover:text-[#E8EBE4]">
              ? Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-[#E8EBE4] mb-1">Reset password</h1>
            <p className="text-sm text-[#6B6E67] mb-6">Enter your email and we'll send a reset link.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#E8EBE4] mb-1.5">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@yourgym.com"
                  required
                  autoComplete="email"
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
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>

            <p className="text-xs text-[#6B6E67] mt-4 text-center">
              <Link href="/login" className="hover:text-[#E8EBE4]">? Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
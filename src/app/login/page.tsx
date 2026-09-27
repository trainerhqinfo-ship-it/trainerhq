"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const resetSuccess = searchParams.get("reset") === "1";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !data.user) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profile?.role === "trainer") {
      window.location.href = "/trainer";
    } else {
      window.location.href = "/manager";
    }
  }

  return (
    <div className="min-h-screen bg-[#1A1C18] flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-[420px] flex-shrink-0 bg-[#151715] flex-col p-10">
        <div className="flex items-center gap-2.5 mb-auto">
          <div className="w-8 h-8 bg-[#B9E84A] rounded-md flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" fill="#151715"/>
              <rect x="8" y="1" width="5" height="5" rx="1" fill="#151715"/>
              <rect x="1" y="8" width="5" height="5" rx="1" fill="#151715"/>
              <rect x="8" y="8" width="2" height="5" rx="1" fill="#151715"/>
              <rect x="11" y="8" width="2" height="2" rx="0.5" fill="#151715"/>
            </svg>
          </div>
          <span className="text-white font-semibold text-base tracking-tight">TrainerHQ</span>
        </div>

        <div className="mb-auto">
          <h2 className="text-2xl font-semibold text-white leading-tight mb-3">
            The operating system for your gym&apos;s trainers.
          </h2>
          <p className="text-[#6B6E67] text-sm leading-relaxed">
            Manage trainer schedules, PT client assignments, capacity, sessions, and payouts &mdash; all from one place.
          </p>

          <div className="mt-10 space-y-4">
            {[
              { label: "Capacity-based scheduling", desc: "Track trainer slots as 2/3 -- not just available/booked" },
              { label: "Smart reassignment", desc: "Move clients between trainers with instant capacity validation" },
              { label: "Transparent payouts", desc: "Commission history preserved, monthly payouts calculated accurately" },
            ].map((feat) => (
              <div key={feat.label} className="flex gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#B9E84A] mt-1.5 flex-shrink-0" />
                <div>
                  <div className="text-white text-sm font-medium">{feat.label}</div>
                  <div className="text-[#6B6E67] text-xs mt-0.5">{feat.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/[0.06] pt-6">
          <div className="flex items-center gap-3">
            <div className="bg-[#B9E84A]/15 text-[#B9E84A] text-xs px-2 py-1 rounded-md border border-[#B9E84A]/30 font-medium">
              DEMO
            </div>
            <div className="text-[#6B6E67] text-xs">
              Iron Kingdom &mdash; Kokapet
            </div>
          </div>
          <div className="mt-2 space-y-1">
            <div className="text-[#4A4D47] text-xs">Manager: manager@ironkingdom.in</div>
            <div className="text-[#4A4D47] text-xs">Trainer: rahul@ironkingdom.in</div>
            <div className="text-[#4A4D47] text-xs">Password: demo1234</div>
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-7 h-7 bg-[#B9E84A] rounded-md flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1" fill="#151715"/>
                <rect x="8" y="1" width="5" height="5" rx="1" fill="#151715"/>
                <rect x="1" y="8" width="5" height="5" rx="1" fill="#151715"/>
                <rect x="8" y="8" width="2" height="5" rx="1" fill="#151715"/>
              </svg>
            </div>
            <span className="font-semibold text-[#E8EBE4]">TrainerHQ</span>
          </div>

          <h1 className="text-xl font-semibold text-[#E8EBE4] mb-1">Sign in</h1>
          <p className="text-sm text-[#6B6E67] mb-6">Enter your credentials to continue</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#E8EBE4] mb-1.5">Email address</label>
              <input
                type="email"
                placeholder="you@yourgym.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full px-3 py-2.5 text-sm border border-[#2E3129] rounded-lg bg-[#222520] focus:outline-none focus:ring-2 focus:ring-[#B9E84A]/50 focus:border-[#B9E84A] text-[#E8EBE4] placeholder-[#6B6E67]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#E8EBE4] mb-1.5">Password</label>
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3 py-2.5 text-sm border border-[#2E3129] rounded-lg bg-[#222520] focus:outline-none focus:ring-2 focus:ring-[#B9E84A]/50 focus:border-[#B9E84A] text-[#E8EBE4] placeholder-[#6B6E67]"
              />
            </div>

            {resetSuccess && (
              <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
                Password updated. Sign in with your new password.
              </div>
            )}

            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#B9E84A] hover:bg-[#A8D63A] disabled:opacity-60 text-[#171917] font-semibold text-sm py-3 rounded-xl transition-colors"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="text-xs text-[#6B6E67] mt-4 text-center">
            <Link href="/forgot-password" className="hover:text-[#E8EBE4]">Forgot password?</Link>
          </p>
          <p className="text-xs text-[#6B6E67] mt-2 text-center">
            TrainerHQ is for gym managers and trainers only.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

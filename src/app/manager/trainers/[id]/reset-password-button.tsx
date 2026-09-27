"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Mail } from "lucide-react";

export function ResetPasswordButton({ trainerEmail }: { trainerEmail: string }) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(trainerEmail, {
      redirectTo: `${window.location.origin}/login`,
    });
    setSent(true);
    setLoading(false);
  };

  return (
    <button
      type="button"
      onClick={handleReset}
      disabled={loading || sent}
      className="flex items-center gap-1.5 text-xs font-medium border border-[#2E3129] text-[#9B9E96] px-3 py-2 rounded-lg hover:bg-[#1A1C18] transition-colors disabled:opacity-60"
    >
      <Mail size={12} />
      {sent ? "Reset Email Sent!" : loading ? "Sending..." : "Send Password Reset Email"}
    </button>
  );
}

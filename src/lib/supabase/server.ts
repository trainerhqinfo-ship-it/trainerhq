import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

// Per-request memoized auth + profile lookup.
// React cache() ensures layout and page share one DB query per render, never
// two. Each request gets its own cache scope — nothing leaks between users.
export const getProfile = cache(async () => {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, gym_id, role, first_name, last_name")
    .eq("id", session.user.id)
    .single();
  if (!data?.gym_id) return null;
  return {
    user: session.user,
    id: data.id as string,
    gymId: data.gym_id as string,
    role: (data.role ?? "") as string,
    firstName: (data.first_name ?? "") as string,
    lastName: (data.last_name ?? "") as string,
  };
});

// Per-request memoized gym lookup. Cached so layout and pages that both need
// gym data share one query instead of two.
export const getGymData = cache(async (gymId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gyms")
    .select("name, branch_name, default_slot_duration")
    .eq("id", gymId)
    .single();
  return data ?? null;
});

// Kept for backwards compat with server actions that call it.
export async function getSessionUser() {
  const profile = await getProfile();
  return profile?.user ?? null;
}

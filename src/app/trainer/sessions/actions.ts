"use server";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function completeSession(sessionId: string, notes: string) {
  const supabase = await createClient();
  const user = await getSessionUser();
  const { data: trainer } = await supabase.from("trainers").select("id").eq("user_id", user!.id).single();
  if (!trainer) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("pt_sessions")
    .update({
      status: "completed",
      notes: notes || null,
    })
    .eq("id", sessionId)
    .eq("trainer_id", trainer.id);

  revalidatePath("/trainer/sessions");
  revalidatePath("/trainer");
}

export async function updateSessionNotes(sessionId: string, notes: string) {
  const supabase = await createClient();
  const user = await getSessionUser();
  const { data: trainer } = await supabase.from("trainers").select("id").eq("user_id", user!.id).single();
  if (!trainer) return;

  await supabase.from("pt_sessions")
    .update({ notes })
    .eq("id", sessionId)
    .eq("trainer_id", trainer.id);

  revalidatePath("/trainer/sessions");
}

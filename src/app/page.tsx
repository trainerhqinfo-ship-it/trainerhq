import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createClient();
  const user = await getSessionUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "trainer") redirect("/trainer");
  redirect("/manager");
}

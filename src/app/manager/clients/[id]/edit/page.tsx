import { notFound, redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { ClientForm } from "@/components/forms/client-form";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user.id).single();
  const gymId = profile?.gym_id;
  if (!gymId) redirect("/login");

  const { data: client } = await supabase.from("pt_clients")
    .select("*").eq("id", id).eq("gym_id", gymId).single();

  if (!client) notFound();

  return (
    <div>
      <Header title="Edit Client" subtitle={`${client.first_name} ${client.last_name}`} />
      <div className="px-8 py-6 max-w-2xl">
        <ClientForm client={client} />
      </div>
    </div>
  );
}

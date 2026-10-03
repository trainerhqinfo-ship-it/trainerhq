import { notFound, redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { ClientForm } from "@/components/forms/client-form";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const profile = await getProfile();
  if (!profile) redirect("/login");
  const { gymId } = profile;

  const supabase = await createClient();

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

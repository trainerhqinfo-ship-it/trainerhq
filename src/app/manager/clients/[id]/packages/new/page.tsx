import { notFound, redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { RenewalForm } from "./renewal-form";

export default async function NewPackagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await params;

  const profile = await getProfile();
  if (!profile) redirect("/login");
  const { gymId } = profile;

  const supabase = await createClient();

  const [{ data: client }, { data: latestPkg }, { data: assignment }] = await Promise.all([
    supabase
      .from("pt_clients")
      .select("id, first_name, last_name, phone, status")
      .eq("id", clientId)
      .eq("gym_id", gymId)
      .single(),
    supabase
      .from("pt_packages")
      .select("id, package_name, start_date, end_date, amount_collected, invoice_number")
      .eq("client_id", clientId)
      .eq("gym_id", gymId)
      .order("start_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("pt_assignments")
      .select("id, trainer_id, preferred_time, days_of_week, trainers(id, first_name, last_name)")
      .eq("client_id", clientId)
      .eq("gym_id", gymId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  if (!client) notFound();

  return (
    <div>
      <Header
        title={`Renew PT Package`}
        subtitle={`${client.first_name} ${client.last_name}`}
      />
      <div className="px-6 md:px-8 py-5 max-w-2xl">
        <RenewalForm
          clientId={clientId}
          clientName={`${client.first_name} ${client.last_name}`}
          clientPhone={client.phone ?? null}
          prevPackage={latestPkg as any ?? null}
          currentAssignment={assignment as any ?? null}
          gymId={gymId}
        />
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { UserPlus } from "lucide-react";
import { ClientsTable } from "./clients-table";

export default async function ManagerClientsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user.id).single();
  const gymId = profile?.gym_id;
  if (!gymId) redirect("/login");

  const [{ data: clientsRaw }, { data: assignmentsRaw }] = await Promise.all([
    supabase
      .from("pt_clients")
      .select("id, first_name, last_name, email, phone, status, start_date, goal")
      .eq("gym_id", gymId)
      .order("first_name"),
    supabase
      .from("pt_assignments")
      .select("client_id, trainers(first_name, last_name)")
      .eq("gym_id", gymId)
      .eq("status", "active"),
  ]);

  const clients = clientsRaw ?? [];
  const assignments = assignmentsRaw ?? [];
  const activeCount = clients.filter(c => c.status === "active").length;
  const inactiveCount = clients.filter(c => c.status !== "active").length;

  return (
    <div>
      <Header
        title="PT Clients"
        subtitle={`${activeCount} active · ${inactiveCount} inactive`}
        actions={
          <a
            href="/manager/clients/new"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#B9E84A] text-[#171917] text-xs font-semibold hover:bg-[#A8D63A] transition-colors"
          >
            <UserPlus size={13} />
            Add Client
          </a>
        }
      />
      <div className="px-8 py-6">
        <ClientsTable clients={clients as any} assignments={assignments as any} />
      </div>
    </div>
  );
}

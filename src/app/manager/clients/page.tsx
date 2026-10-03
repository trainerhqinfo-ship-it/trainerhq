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

  const [
    { data: clientsRaw },
    { data: assignmentsRaw },
    { data: packagesRaw },
    { data: completedSessionsRaw },
  ] = await Promise.all([
    supabase
      .from("pt_clients")
      .select("id, first_name, last_name, email, phone, status, goal, joining_date")
      .eq("gym_id", gymId)
      .order("first_name"),
    supabase
      .from("pt_assignments")
      .select("client_id, trainers(first_name, last_name)")
      .eq("gym_id", gymId)
      .eq("status", "active"),
    supabase
      .from("pt_packages")
      .select("client_id, package_name, total_sessions, amount_collected, package_value, end_date")
      .eq("gym_id", gymId)
      .eq("is_active", true),
    supabase
      .from("pt_sessions")
      .select("client_id")
      .eq("gym_id", gymId)
      .eq("status", "completed"),
  ]);

  const clients = clientsRaw ?? [];
  const assignments = assignmentsRaw ?? [];

  const packageByClient: Record<string, any> = {};
  (packagesRaw ?? []).forEach((p: any) => { packageByClient[p.client_id] = p; });

  const completedByClient: Record<string, number> = {};
  (completedSessionsRaw ?? []).forEach((s: any) => {
    completedByClient[s.client_id] = (completedByClient[s.client_id] ?? 0) + 1;
  });

  const enrichedClients = clients.map((c: any) => ({
    ...c,
    pkg: packageByClient[c.id] ?? null,
    sessionsCompleted: completedByClient[c.id] ?? 0,
  }));

  const activeCount = clients.filter((c: any) => c.status === "active").length;
  const inactiveCount = clients.filter((c: any) => c.status !== "active").length;

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
        <ClientsTable clients={enrichedClients as any} assignments={assignments as any} />
      </div>
    </div>
  );
}

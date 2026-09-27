"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { GOALS, DAY_NAMES_FULL } from "@/lib/utils";
import type { PtClient } from "@/types/database";

interface ClientFormProps {
  client?: PtClient;
}

export function ClientForm({ client }: ClientFormProps) {
  const router = useRouter();
  const isEdit = !!client;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    first_name: client?.first_name ?? "",
    last_name: client?.last_name ?? "",
    email: client?.email ?? "",
    phone: client?.phone ?? "",
    gender: client?.gender ?? "",
    goal: client?.goal ?? "",
    joining_date: client?.joining_date ?? new Date().toISOString().split("T")[0],
    pt_start_date: client?.pt_start_date ?? new Date().toISOString().split("T")[0],
    preferred_time: client?.preferred_time ?? "19:00",
    preferred_days: client?.preferred_days ?? [1, 3, 5],
    notes: client?.notes ?? "",
    // Package
    total_sessions: "20",
    package_value: "20000",
    package_name: "20 Sessions Pack",
  });

  function toggleDay(d: number) {
    setFormData(prev => ({
      ...prev,
      preferred_days: prev.preferred_days.includes(d)
        ? prev.preferred_days.filter(x => x !== d)
        : [...prev.preferred_days, d].sort(),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user!.id).single();
    const gymId = profile?.gym_id!;

    try {
      if (isEdit && client) {
        await supabase.from("pt_clients").update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email || null,
          phone: formData.phone || null,
          gender: (formData.gender as PtClient["gender"]) || null,
          goal: formData.goal || null,
          preferred_time: formData.preferred_time || null,
          preferred_days: formData.preferred_days,
          notes: formData.notes || null,
          updated_at: new Date().toISOString(),
        }).eq("id", client.id);
        router.push(`/manager/clients/${client.id}`);
      } else {
        const { data: newClient, error: err } = await supabase.from("pt_clients").insert({
          gym_id: gymId,
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email || null,
          phone: formData.phone || null,
          gender: (formData.gender as PtClient["gender"]) || null,
          goal: formData.goal || null,
          joining_date: formData.joining_date,
          pt_start_date: formData.pt_start_date || null,
          preferred_time: formData.preferred_time || null,
          preferred_days: formData.preferred_days,
          notes: formData.notes || null,
          status: "active",
        }).select().single();
        if (err) throw err;

        // Create package if sessions specified
        if (formData.total_sessions) {
          await supabase.from("pt_packages").insert({
            client_id: newClient.id,
            gym_id: gymId,
            package_name: formData.package_name || `${formData.total_sessions} Sessions Pack`,
            total_sessions: parseInt(formData.total_sessions),
            package_value: formData.package_value ? parseFloat(formData.package_value) : null,
            amount_collected: formData.package_value ? parseFloat(formData.package_value) : null,
            start_date: formData.pt_start_date || formData.joining_date,
            is_active: true,
          });
        }

        router.push(`/manager/clients/${newClient.id}`);
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-[#E8EBE4]">Client Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="First Name *"
            value={formData.first_name}
            onChange={e => setFormData(p => ({ ...p, first_name: e.target.value }))}
            required
          />
          <Input
            label="Last Name *"
            value={formData.last_name}
            onChange={e => setFormData(p => ({ ...p, last_name: e.target.value }))}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Phone"
            value={formData.phone}
            onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
            placeholder="+91-9800000000"
          />
          <Input
            label="Email"
            type="email"
            value={formData.email}
            onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Gender"
            value={formData.gender}
            onChange={e => setFormData(p => ({ ...p, gender: e.target.value }))}
            options={[
              { value: "", label: "Not specified" },
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
              { value: "other", label: "Other" },
            ]}
          />
          <Select
            label="Fitness Goal"
            value={formData.goal}
            onChange={e => setFormData(p => ({ ...p, goal: e.target.value }))}
            options={[
              { value: "", label: "Select goal..." },
              ...GOALS.map(g => ({ value: g, label: g })),
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Joining Date"
            type="date"
            value={formData.joining_date}
            onChange={e => setFormData(p => ({ ...p, joining_date: e.target.value }))}
          />
          <Input
            label="PT Start Date"
            type="date"
            value={formData.pt_start_date}
            onChange={e => setFormData(p => ({ ...p, pt_start_date: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[#E8EBE4] mb-2 block">Preferred Days</label>
          <div className="flex gap-2">
            {[0,1,2,3,4,5,6].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={`w-9 h-9 rounded-lg text-xs font-medium border transition-colors ${
                  formData.preferred_days.includes(d)
                    ? "bg-[#B9E84A] text-[#171917] border-[#A8D63A]"
                    : "bg-[#222520] text-[#6B6E67] border-[#2E3129] hover:border-[#E8EBE4]"
                }`}
              >
                {DAY_NAMES_FULL[d].slice(0, 2)}
              </button>
            ))}
          </div>
        </div>
        <Input
          label="Preferred Time"
          type="time"
          value={formData.preferred_time}
          onChange={e => setFormData(p => ({ ...p, preferred_time: e.target.value }))}
        />
        <Textarea
          label="Notes"
          value={formData.notes}
          onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
          placeholder="Any special requirements or health notes..."
        />
      </div>

      {!isEdit && (
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-[#E8EBE4]">PT Package</h2>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Package Name"
              value={formData.package_name}
              onChange={e => setFormData(p => ({ ...p, package_name: e.target.value }))}
              placeholder="20 Sessions Pack"
            />
            <Input
              label="Total Sessions"
              type="number"
              min="1"
              value={formData.total_sessions}
              onChange={e => setFormData(p => ({ ...p, total_sessions: e.target.value }))}
            />
          </div>
          <Input
            label="Package Value (?)"
            type="number"
            min="0"
            value={formData.package_value}
            onChange={e => setFormData(p => ({ ...p, package_value: e.target.value }))}
            placeholder="20000"
          />
        </div>
      )}

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" variant="primary" loading={loading}>
          {isEdit ? "Save Changes" : "Create Client"}
        </Button>
      </div>
    </form>
  );
}
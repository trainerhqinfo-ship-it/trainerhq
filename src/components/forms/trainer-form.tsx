"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { SPECIALIZATIONS, DAY_NAMES_FULL } from "@/lib/utils";
import type { Trainer } from "@/types/database";

interface WorkingHourProp {
  day_of_week: number;
  is_working_day: boolean;
  start_time: string;
  end_time: string;
}

interface TrainerFormProps {
  trainer?: Trainer;
  gymId?: string;
  initialWorkingHours?: WorkingHourProp[];
}

const DEFAULT_WORKING_HOURS = [0, 1, 2, 3, 4, 5, 6].map(d => ({
  day_of_week: d,
  is_working_day: d >= 1 && d <= 6,
  start_time: "06:00",
  end_time: "22:00",
}));

export function TrainerForm({ trainer, gymId, initialWorkingHours }: TrainerFormProps) {
  const router = useRouter();
  const isEdit = !!trainer;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    first_name: trainer?.first_name ?? "",
    last_name: trainer?.last_name ?? "",
    email: trainer?.email ?? "",
    phone: trainer?.phone ?? "",
    gender: trainer?.gender ?? "",
    bio: trainer?.bio ?? "",
    role_title: trainer?.role_title ?? "Personal Trainer",
    experience_years: trainer?.experience_years?.toString() ?? "0",
    specializations: trainer?.specializations ?? [],
    certifications: trainer?.certifications?.join(", ") ?? "",
    joining_date: trainer?.joining_date ?? new Date().toISOString().split("T")[0],
    status: trainer?.status ?? "active",
    max_clients_per_slot: trainer?.max_clients_per_slot?.toString() ?? "2",
    commission_type: "percentage",
    commission_value: "40",
    working_hours: initialWorkingHours?.length === 7
      ? initialWorkingHours.map(wh => ({
          day_of_week: wh.day_of_week,
          is_working_day: wh.is_working_day,
          start_time: wh.start_time,
          end_time: wh.end_time,
        }))
      : DEFAULT_WORKING_HOURS,
  });

  function toggle(field: "specializations", value: string) {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v: string) => v !== value)
        : [...prev[field], value],
    }));
  }

  function updateWH(day: number, field: string, value: string | boolean) {
    setFormData(prev => ({
      ...prev,
      working_hours: prev.working_hours.map(wh =>
        wh.day_of_week === day ? { ...wh, [field]: value } : wh
      ),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user!.id).single();
    const gId = gymId ?? profile?.gym_id;

    try {
      if (isEdit && trainer) {
        const { error: err } = await supabase.from("trainers").update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email || null,
          phone: formData.phone || null,
          gender: (formData.gender as Trainer["gender"]) || null,
          bio: formData.bio || null,
          role_title: formData.role_title,
          experience_years: parseInt(formData.experience_years),
          specializations: formData.specializations,
          certifications: formData.certifications.split(",").map(c => c.trim()).filter(Boolean),
          joining_date: formData.joining_date,
          status: formData.status as Trainer["status"],
          max_clients_per_slot: parseInt(formData.max_clients_per_slot),
          updated_at: new Date().toISOString(),
        }).eq("id", trainer.id);
        if (err) throw err;

        // Upsert working hours — update each row by trainer_id + day_of_week
        await Promise.all(formData.working_hours.map(wh =>
          supabase.from("trainer_working_hours")
            .update({
              is_working_day: wh.is_working_day,
              start_time: wh.start_time,
              end_time: wh.end_time,
            })
            .eq("trainer_id", trainer.id)
            .eq("day_of_week", wh.day_of_week)
        ));

        router.push(`/manager/trainers/${trainer.id}`);
      } else {
        const { data: newTrainer, error: err } = await supabase.from("trainers").insert({
          gym_id: gId!,
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email || null,
          phone: formData.phone || null,
          gender: (formData.gender as Trainer["gender"]) || null,
          bio: formData.bio || null,
          role_title: formData.role_title,
          experience_years: parseInt(formData.experience_years),
          specializations: formData.specializations,
          certifications: formData.certifications.split(",").map(c => c.trim()).filter(Boolean),
          joining_date: formData.joining_date,
          status: "active",
          max_clients_per_slot: parseInt(formData.max_clients_per_slot),
        }).select().single();

        if (err) throw err;

        // Working hours
        const whPayloads = formData.working_hours.map(wh => ({
          trainer_id: newTrainer.id,
          gym_id: gId!,
          day_of_week: wh.day_of_week,
          start_time: wh.start_time,
          end_time: wh.end_time,
          is_working_day: wh.is_working_day,
        }));
        await supabase.from("trainer_working_hours").insert(whPayloads);

        // Commission rule
        await supabase.from("trainer_commission_rules").insert({
          trainer_id: newTrainer.id,
          gym_id: gId!,
          commission_type: formData.commission_type as "percentage" | "fixed_per_session",
          commission_value: parseFloat(formData.commission_value),
          effective_from: formData.joining_date,
        });

        // Audit log
        await supabase.from("audit_logs").insert({
          gym_id: gId!,
          user_id: user!.id,
          action: "trainer_created",
          entity_type: "trainer",
          entity_id: newTrainer.id,
          new_values: { name: `${formData.first_name} ${formData.last_name}` },
        });

        router.push(`/manager/trainers/${newTrainer.id}`);
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Step tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#2E3129] pb-0">
        {[
          { n: 1, label: "Personal Info" },
          { n: 2, label: "Professional" },
          { n: 3, label: "Schedule & Capacity" },
          { n: 4, label: "Commission" },
        ].map(s => (
          <button
            key={s.n}
            type="button"
            onClick={() => setStep(s.n)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              step === s.n
                ? "border-[#E8EBE4] text-[#E8EBE4]"
                : "border-transparent text-[#6B6E67] hover:text-[#E8EBE4]"
            }`}
          >
            {s.n}. {s.label}
          </button>
        ))}
      </div>

      {/* Step 1: Personal */}
      {step === 1 && (
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Name *"
              value={formData.first_name}
              onChange={e => setFormData(p => ({ ...p, first_name: e.target.value }))}
              required
              placeholder="Rahul"
            />
            <Input
              label="Last Name *"
              value={formData.last_name}
              onChange={e => setFormData(p => ({ ...p, last_name: e.target.value }))}
              required
              placeholder="Sharma"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
              placeholder="trainer@gym.com"
            />
            <Input
              label="Phone"
              value={formData.phone}
              onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
              placeholder="+91-9800000000"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Gender"
              value={formData.gender}
              onChange={e => setFormData(p => ({ ...p, gender: e.target.value }))}
              options={[
                { value: "", label: "Prefer not to say" },
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
                { value: "other", label: "Other" },
              ]}
            />
            <Input
              label="Joining Date"
              type="date"
              value={formData.joining_date}
              onChange={e => setFormData(p => ({ ...p, joining_date: e.target.value }))}
            />
          </div>
          <Textarea
            label="Bio"
            value={formData.bio}
            onChange={e => setFormData(p => ({ ...p, bio: e.target.value }))}
            placeholder="Brief professional background..."
          />
          <div className="flex justify-end">
            <Button type="button" variant="primary" onClick={() => setStep(2)}>
              Next: Professional ?
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Professional */}
      {step === 2 && (
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Role Title"
              value={formData.role_title}
              onChange={e => setFormData(p => ({ ...p, role_title: e.target.value }))}
              placeholder="Personal Trainer"
            />
            <Input
              label="Experience (years)"
              type="number"
              min="0"
              value={formData.experience_years}
              onChange={e => setFormData(p => ({ ...p, experience_years: e.target.value }))}
            />
          </div>
          <Input
            label="Certifications (comma-separated)"
            value={formData.certifications}
            onChange={e => setFormData(p => ({ ...p, certifications: e.target.value }))}
            placeholder="ACE Certified PT, ISSA Nutrition"
          />
          <div>
            <label className="text-xs font-medium text-[#E8EBE4] mb-2 block">Specializations</label>
            <div className="flex flex-wrap gap-2">
              {SPECIALIZATIONS.map(spec => (
                <button
                  key={spec}
                  type="button"
                  onClick={() => toggle("specializations", spec)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    formData.specializations.includes(spec)
                      ? "bg-[#B9E84A] text-[#171917] border-[#A8D63A]"
                      : "bg-[#222520] text-[#6B6E67] border-[#2E3129] hover:border-[#E8EBE4]"
                  }`}
                >
                  {spec}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>? Back</Button>
            <Button type="button" variant="primary" onClick={() => setStep(3)}>Next: Schedule ?</Button>
          </div>
        </div>
      )}

      {/* Step 3: Schedule & Capacity */}
      {step === 3 && (
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-6 space-y-5">
          <div>
            <label className="text-xs font-medium text-[#E8EBE4] mb-3 block">Working Hours</label>
            <div className="space-y-2">
              {formData.working_hours.map(wh => (
                <div key={wh.day_of_week} className="flex items-center gap-3">
                  <div className="w-20">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={wh.is_working_day}
                        onChange={e => updateWH(wh.day_of_week, "is_working_day", e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-xs text-[#E8EBE4]">{DAY_NAMES_FULL[wh.day_of_week].slice(0, 3)}</span>
                    </label>
                  </div>
                  {wh.is_working_day ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        value={wh.start_time}
                        onChange={e => updateWH(wh.day_of_week, "start_time", e.target.value)}
                        className="h-8 px-2 text-xs rounded-lg border border-[#2E3129] focus:outline-none focus:ring-2 focus:ring-[#B9E84A]/50"
                      />
                      <span className="text-xs text-[#6B6E67]">to</span>
                      <input
                        type="time"
                        value={wh.end_time}
                        onChange={e => updateWH(wh.day_of_week, "end_time", e.target.value)}
                        className="h-8 px-2 text-xs rounded-lg border border-[#2E3129] focus:outline-none focus:ring-2 focus:ring-[#B9E84A]/50"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-[#6B6E67]">Weekly off</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[#E8EBE4] mb-2 block">
              Maximum Simultaneous PT Clients
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, max_clients_per_slot: n.toString() }))}
                  className={`w-10 h-10 rounded-lg text-sm font-semibold border transition-colors ${
                    formData.max_clients_per_slot === n.toString()
                      ? "bg-[#B9E84A] text-[#171917] border-[#A8D63A]"
                      : "bg-[#222520] text-[#6B6E67] border-[#2E3129] hover:border-[#E8EBE4]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#6B6E67] mt-1.5">
              How many PT clients can this trainer handle in the same time slot?
            </p>
          </div>

          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(2)}>? Back</Button>
            <Button type="button" variant="primary" onClick={() => setStep(4)}>Next: Commission ?</Button>
          </div>
        </div>
      )}

      {/* Step 4: Commission */}
      {step === 4 && (
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-6 space-y-5">
          <div>
            <label className="text-xs font-medium text-[#E8EBE4] mb-3 block">Commission Model</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  value: "percentage",
                  title: "Percentage of PT Revenue",
                  desc: "Trainer earns a % of eligible PT revenue",
                  eg: "40% of ?1,00,000 = ?40,000",
                },
                {
                  value: "fixed_per_session",
                  title: "Fixed Per Completed Session",
                  desc: "Fixed amount for each completed session",
                  eg: "?500 × 92 sessions = ?46,000",
                },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, commission_type: opt.value }))}
                  className={`p-4 rounded-xl border text-left transition-colors ${
                    formData.commission_type === opt.value
                      ? "bg-[#B9E84A]/10 border-[#B9E84A] shadow-sm"
                      : "bg-[#222520] border-[#2E3129] hover:border-[#E8EBE4]"
                  }`}
                >
                  <div className="text-sm font-medium text-[#E8EBE4] mb-1">{opt.title}</div>
                  <div className="text-xs text-[#6B6E67]">{opt.desc}</div>
                  <div className="text-xs text-[#6B6E67] mt-2 font-mono">{opt.eg}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                label={formData.commission_type === "percentage" ? "Commission %" : "Amount per client (?)"}
                type="number"
                min="0"
                step="0.01"
                value={formData.commission_value}
                onChange={e => setFormData(p => ({ ...p, commission_value: e.target.value }))}
                placeholder={formData.commission_type === "percentage" ? "40" : "500"}
              />
            </div>
            <div className="h-9 px-4 rounded-lg bg-[#222520] border border-[#2E3129] flex items-center text-sm font-medium text-[#E8EBE4]">
              {formData.commission_type === "percentage"
                ? `${formData.commission_value}%`
                : `?${formData.commission_value}/client`}
            </div>
          </div>

          <div className="bg-[#1A1C18] rounded-lg p-3">
            <p className="text-xs text-[#6B6E67] leading-relaxed">
              <strong className="text-[#E8EBE4]">Important:</strong> Commission rules are versioned. Changing commission later will not affect historical payouts. Monthly payouts use the rule that was active during that period.
            </p>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(3)}>? Back</Button>
            <Button type="submit" variant="primary" loading={loading}>
              {isEdit ? "Save Changes" : "Create Trainer"}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
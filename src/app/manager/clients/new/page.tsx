"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/header";
import { Avatar } from "@/components/ui/avatar";
import { DAY_NAMES } from "@/lib/utils";
import {
  Upload, FileText, CheckCircle, ChevronRight, ChevronLeft,
  Edit3, AlertTriangle, User, Phone, Package, Calendar,
  Hash, Loader2, X, ExternalLink,
} from "lucide-react";
import type { ExtractedBillData } from "@/app/api/extract-bill/route";

type Step = 1 | 2 | 3 | 4;

interface FormData {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  package_name: string;
  sessions_total: number;
  price_paid: number;
  start_date: string;
  end_date: string;
  invoice_number: string;
  notes: string;
  trainer_id: string;
  preferred_time: string;
  days_of_week: number[];
}

const TIME_SLOTS = Array.from({ length: 34 }, (_, i) => {
  const totalMins = 5 * 60 + i * 30;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const label = `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  return { value, label };
});

function StepIndicator({ current, total }: { current: number; total: number }) {
  const steps = ["Upload Bill", "Review Details", "Assign Trainer", "Confirm"];
  return (
    <div className="flex items-center gap-0">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center">
            <div className="flex items-center gap-1.5">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
                  done
                    ? "bg-[#B9E84A] text-[#171917] border-[#B9E84A]"
                    : active
                    ? "bg-[#B9E84A]/20 text-[#B9E84A] border-[#B9E84A]"
                    : "bg-transparent text-[#4A4D47] border-[#2E3129]"
                }`}
              >
                {done ? <CheckCircle size={12} /> : n}
              </div>
              <span
                className={`text-[11px] font-medium hidden sm:block ${
                  active ? "text-[#E8EBE4]" : done ? "text-[#B9E84A]" : "text-[#4A4D47]"
                }`}
              >
                {label}
              </span>
            </div>
            {n < total && (
              <div className={`w-8 sm:w-12 h-px mx-2 ${done ? "bg-[#B9E84A]/40" : "bg-[#2E3129]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FieldRow({
  icon: Icon,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  icon: any;
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[#2E3129] last:border-0">
      <Icon size={14} className="text-[#6B6E67] flex-shrink-0" />
      <span className="text-xs text-[#6B6E67] w-28 flex-shrink-0">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder ?? `Enter ${label.toLowerCase()}`}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent text-sm text-[#E8EBE4] focus:outline-none placeholder-[#4A4D47]"
      />
    </div>
  );
}

export default function NewClientPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [uploading, setUploading] = useState(false);
  const [uploadWarning, setUploadWarning] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loadingTrainers, setLoadingTrainers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const [form, setForm] = useState<FormData>({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    package_name: "",
    sessions_total: 0,
    price_paid: 0,
    start_date: today,
    end_date: "",
    invoice_number: "",
    notes: "",
    trainer_id: "",
    preferred_time: "07:00",
    days_of_week: [1, 3, 5],
  });

  const update = useCallback((key: keyof FormData, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  function toggleDay(d: number) {
    setForm((prev) => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(d)
        ? prev.days_of_week.filter((x) => x !== d)
        : [...prev.days_of_week, d].sort(),
    }));
  }

  useEffect(() => {
    if (step === 3 && trainers.length === 0) {
      setLoadingTrainers(true);
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return;
        supabase.from("profiles").select("gym_id").eq("id", user.id).single().then(({ data: profile }) => {
          if (!profile?.gym_id) return;
          supabase
            .from("trainers")
            .select("id, first_name, last_name, profile_picture_url, max_clients_per_slot, specializations, pt_assignments(trainer_id, days_of_week, preferred_time, status)")
            .eq("gym_id", profile.gym_id)
            .eq("status", "active")
            .order("first_name")
            .then(({ data }) => {
              setTrainers(data ?? []);
              setLoadingTrainers(false);
            });
        });
      });
    }
  }, [step, trainers.length]);

  async function handleFileUpload(f: File) {
    if (f.size > 10 * 1024 * 1024) {
      setUploadWarning("File too large (max 10MB). Please fill in the details manually.");
      setFile(f);
      setStep(2);
      return;
    }

    setFile(f);
    setUploading(true);
    setUploadWarning("");

    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/extract-bill", { method: "POST", body: fd });
      const json = await res.json();

      if (json.error) {
        setUploadWarning(json.error);
      } else if (json.warning) {
        setUploadWarning(json.warning);
      }

      const d: ExtractedBillData = json.data ?? {};
      setForm((prev) => ({
        ...prev,
        first_name: d.client_first_name ?? "",
        last_name: d.client_last_name ?? "",
        phone: d.client_phone ?? "",
        package_name: d.package_name ?? "",
        sessions_total: d.sessions_total ?? 0,
        price_paid: d.price_paid ?? 0,
        start_date: d.start_date ?? today,
        end_date: d.end_date ?? "",
        invoice_number: d.invoice_number ?? "",
        notes: d.notes ?? "",
      }));
    } catch {
      setUploadWarning("Extraction failed. Please fill in the details manually.");
    } finally {
      setUploading(false);
      setStep(2);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFileUpload(f);
  }

  async function handleSubmit() {
    if (!form.first_name) { setSubmitError("Client first name is required."); return; }
    if (!form.trainer_id) { setSubmitError("Please select a trainer."); return; }
    if (!form.price_paid || form.price_paid <= 0) { setSubmitError("Price paid is required."); return; }

    setSubmitting(true);
    setSubmitError("");

    let clientId: string | null = null;
    let packageId: string | null = null;

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated.");
      const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user.id).single();
      const gymId = profile?.gym_id;
      if (!gymId) throw new Error("Could not determine gym.");

      // 1. Upload bill to Supabase Storage (if file present)
      let billUrl: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() ?? "bin";
        const storagePath = `${gymId}/${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("pt-bills")
          .upload(storagePath, file, { upsert: false });
        if (uploadErr) {
          // Non-fatal: proceed without bill storage
          console.warn("Bill upload failed:", uploadErr.message);
        } else {
          billUrl = uploadData.path;
        }
      }

      // 2. Check for duplicate client by phone
      if (form.phone) {
        const { data: dup } = await supabase
          .from("pt_clients")
          .select("id, first_name, last_name")
          .eq("gym_id", gymId)
          .eq("phone", form.phone)
          .eq("status", "active")
          .maybeSingle();

        if (dup) {
          throw new Error(`A client with this phone number already exists: ${(dup as any).first_name} ${(dup as any).last_name}`);
        }
      }

      // 3. Create pt_client
      const { data: client, error: clientErr } = await supabase
        .from("pt_clients")
        .insert({
          gym_id: gymId,
          first_name: form.first_name,
          last_name: form.last_name || "",
          phone: form.phone || null,
          email: form.email || null,
          status: "active" as const,
        })
        .select()
        .single();

      if (clientErr) throw clientErr;
      clientId = client.id;

      // 4. Create pt_package
      const { data: pkg, error: pkgErr } = await supabase
        .from("pt_packages")
        .insert({
          gym_id: gymId,
          client_id: client.id,
          package_name: form.package_name || null,
          total_sessions: form.sessions_total || 0,
          package_value: form.price_paid || null,
          amount_collected: form.price_paid || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          invoice_number: form.invoice_number || null,
          bill_url: billUrl,
          is_active: true,
        } as any)
        .select()
        .single();

      if (pkgErr) throw pkgErr;
      packageId = pkg.id;

      // 5. Check for duplicate assignment before insert
      const { data: dupCheck } = await supabase
        .from("pt_assignments")
        .select("id")
        .eq("gym_id", gymId)
        .eq("trainer_id", form.trainer_id)
        .eq("client_id", client.id)
        .eq("preferred_time", form.preferred_time)
        .eq("status", "active")
        .maybeSingle();

      if (dupCheck) throw new Error("This client already has an active assignment with this trainer at this time.");

      // 6. Create pt_assignment
      const { data: assignment, error: assignErr } = await supabase
        .from("pt_assignments")
        .insert({
          gym_id: gymId,
          client_id: client.id,
          trainer_id: form.trainer_id,
          preferred_time: form.preferred_time,
          days_of_week: form.days_of_week,
          start_date: form.start_date,
          assigned_by: user.id,
          status: "active",
        })
        .select()
        .single();

      if (assignErr) throw assignErr;

      // 7. Audit log
      await supabase.from("audit_logs").insert({
        gym_id: gymId,
        user_id: user.id,
        action: "pt_client_onboarded",
        entity_type: "pt_client",
        entity_id: client.id,
        new_values: {
          client_id: client.id,
          package_id: pkg.id,
          assignment_id: assignment.id,
          trainer_id: form.trainer_id,
          price_paid: form.price_paid,
          invoice_number: form.invoice_number || null,
          bill_url: billUrl,
        },
      });

      router.push(`/manager/clients/${client.id}`);
    } catch (e: any) {
      // Cleanup: delete records created before the failure
      const supabase = createClient();
      if (packageId) await supabase.from("pt_packages").delete().eq("id", packageId);
      if (clientId) await supabase.from("pt_clients").delete().eq("id", clientId);

      setSubmitError(e.message ?? "Something went wrong.");
      setSubmitting(false);
    }
  }

  const selectedTrainer = trainers.find((t) => t.id === form.trainer_id);

  return (
    <div>
      <Header title="Add PT Client" subtitle="Onboard a new personal training member" />
      <div className="px-8 py-6 max-w-2xl">
        <div className="mb-6">
          <StepIndicator current={step} total={4} />
        </div>

        {/* ── STEP 1: Upload Bill ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-[#E8EBE4]">Upload PT Bill</h2>
              <p className="text-sm text-[#6B6E67] mt-1">
                Upload the client&apos;s bill or receipt. We&apos;ll auto-fill the details using AI.
              </p>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
                uploading
                  ? "border-[#B9E84A]/40 bg-[#B9E84A]/5"
                  : "border-[#2E3129] hover:border-[#B9E84A]/40 hover:bg-[#B9E84A]/3"
              }`}
            >
              {uploading ? (
                <>
                  <Loader2 size={32} className="text-[#B9E84A] animate-spin" />
                  <p className="text-sm text-[#9B9E96]">Extracting bill details with AI…</p>
                </>
              ) : (
                <>
                  <Upload size={32} className="text-[#4A4D47]" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-[#E8EBE4]">Drop bill here or click to browse</p>
                    <p className="text-xs text-[#6B6E67] mt-1">JPG, PNG, or PDF · Max 10MB</p>
                  </div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f);
                }}
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-[#2E3129]" />
              <span className="text-xs text-[#4A4D47]">or</span>
              <div className="flex-1 h-px bg-[#2E3129]" />
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full h-11 rounded-xl border border-[#2E3129] text-sm text-[#9B9E96] hover:bg-[#222520] transition-colors flex items-center justify-center gap-2"
            >
              <Edit3 size={14} /> Fill in manually instead
            </button>
          </div>
        )}

        {/* ── STEP 2: Review Details ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#E8EBE4]">Review & Edit Details</h2>
                <p className="text-sm text-[#6B6E67] mt-1">
                  {file ? "Verify the auto-extracted details below." : "Enter the client and package details."}
                </p>
              </div>
              {file && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1A1C18] border border-[#2E3129] rounded-xl text-xs text-[#9B9E96]">
                  <FileText size={12} />
                  <span className="max-w-[120px] truncate">{file.name}</span>
                </div>
              )}
            </div>

            {uploadWarning && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-orange-500/10 border border-orange-500/30 rounded-xl text-xs text-orange-400">
                <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                <span>{uploadWarning}</span>
              </div>
            )}

            <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-4">
              <div className="text-[10px] font-semibold text-[#6B6E67] tracking-wider uppercase mb-2">Client Information</div>
              <FieldRow icon={User} label="First Name *" value={form.first_name} onChange={(v) => update("first_name", v)} placeholder="e.g. Rahul" />
              <FieldRow icon={User} label="Last Name" value={form.last_name} onChange={(v) => update("last_name", v)} placeholder="e.g. Sharma" />
              <FieldRow icon={Phone} label="Phone" value={form.phone} onChange={(v) => update("phone", v)} placeholder="9876543210" type="tel" />
              <FieldRow icon={User} label="Email" value={form.email} onChange={(v) => update("email", v)} placeholder="rahul@example.com" type="email" />
            </div>

            <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-4">
              <div className="text-[10px] font-semibold text-[#6B6E67] tracking-wider uppercase mb-2">Package Details</div>
              <FieldRow icon={Package} label="Package Name" value={form.package_name} onChange={(v) => update("package_name", v)} placeholder="e.g. 3 Month PT Package" />
              <FieldRow icon={Hash} label="Sessions Total" value={form.sessions_total || ""} onChange={(v) => update("sessions_total", parseInt(v) || 0)} type="number" placeholder="e.g. 36" />
              <FieldRow icon={Hash} label="Price Paid (₹) *" value={form.price_paid || ""} onChange={(v) => update("price_paid", parseFloat(v) || 0)} type="number" placeholder="e.g. 15000" />
              <FieldRow icon={Calendar} label="Start Date *" value={form.start_date} onChange={(v) => update("start_date", v)} type="date" />
              <FieldRow icon={Calendar} label="End Date" value={form.end_date} onChange={(v) => update("end_date", v)} type="date" />
              <FieldRow icon={Hash} label="Invoice Number" value={form.invoice_number} onChange={(v) => update("invoice_number", v)} placeholder="e.g. INV-2024-001" />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 h-11 px-5 rounded-xl border border-[#2E3129] text-sm text-[#9B9E96] hover:bg-[#222520] transition-colors"
              >
                <ChevronLeft size={15} /> Back
              </button>
              <button
                onClick={() => { if (!form.first_name) return; setStep(3); }}
                disabled={!form.first_name}
                className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl bg-[#B9E84A] text-[#171917] text-sm font-semibold hover:bg-[#A8D63A] transition-colors disabled:opacity-50"
              >
                Continue <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Select Trainer ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-[#E8EBE4]">Assign to Trainer</h2>
              <p className="text-sm text-[#6B6E67] mt-1">Select a trainer and set the preferred schedule.</p>
            </div>

            <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-[#E8EBE4] mb-1.5 block">Preferred Time</label>
                <select
                  value={form.preferred_time}
                  onChange={(e) => update("preferred_time", e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-[#1A1C18] border border-[#2E3129] rounded-xl text-[#E8EBE4] focus:outline-none focus:border-[#B9E84A] appearance-none cursor-pointer"
                >
                  {TIME_SLOTS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#E8EBE4] mb-2 block">Training Days</label>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      className={`flex-shrink-0 w-10 h-9 rounded-lg text-[11px] font-medium border transition-colors ${
                        form.days_of_week.includes(d)
                          ? "bg-[#B9E84A] text-[#171917] border-[#A8D63A]"
                          : "bg-[#1A1C18] text-[#6B6E67] border-[#2E3129] hover:border-[#E8EBE4]"
                      }`}
                    >
                      {DAY_NAMES[d]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loadingTrainers ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={20} className="text-[#B9E84A] animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {trainers.map((trainer) => {
                  const timeHour = parseInt(form.preferred_time.split(":")[0]);
                  const atTime = (trainer.pt_assignments ?? []).filter((a: any) => {
                    if (a.status !== "active") return false;
                    const aHour = parseInt((a.preferred_time as string).split(":")[0]);
                    const d = a.days_of_week as number[];
                    const dayMatch = !d || d.length === 0 || form.days_of_week.some((x) => d.includes(x));
                    return aHour === timeHour && dayMatch;
                  });
                  const occupied = atTime.length;
                  const max = trainer.max_clients_per_slot;
                  const isFull = occupied >= max;
                  const isSelected = form.trainer_id === trainer.id;

                  return (
                    <button
                      key={trainer.id}
                      type="button"
                      onClick={() => update("trainer_id", trainer.id)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-colors ${
                        isSelected
                          ? "bg-[#B9E84A]/10 border-[#B9E84A]"
                          : "bg-[#222520] border-[#2E3129] hover:border-[#E8EBE4]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar firstName={trainer.first_name} lastName={trainer.last_name} src={trainer.profile_picture_url} size="sm" />
                        <div>
                          <div className="text-sm font-medium text-[#E8EBE4]">
                            {trainer.first_name} {trainer.last_name}
                          </div>
                          {trainer.specializations?.length > 0 && (
                            <div className="text-xs text-[#6B6E67]">
                              {trainer.specializations.slice(0, 2).join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                        isFull
                          ? "bg-red-500/10 text-red-400 border-red-500/30"
                          : occupied > 0
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-[#B9E84A]/15 text-[#B9E84A] border-[#B9E84A]/30"
                      }`}>
                        {occupied}/{max} {isFull ? "FULL" : `· ${max - occupied} free`}
                      </div>
                    </button>
                  );
                })}
                {trainers.length === 0 && (
                  <div className="text-center py-6 text-sm text-[#6B6E67]">No active trainers found</div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 h-11 px-5 rounded-xl border border-[#2E3129] text-sm text-[#9B9E96] hover:bg-[#222520] transition-colors"
              >
                <ChevronLeft size={15} /> Back
              </button>
              <button
                onClick={() => form.trainer_id && setStep(4)}
                disabled={!form.trainer_id}
                className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl bg-[#B9E84A] text-[#171917] text-sm font-semibold hover:bg-[#A8D63A] transition-colors disabled:opacity-50"
              >
                Continue <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Confirm ── */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-[#E8EBE4]">Confirm & Create</h2>
              <p className="text-sm text-[#6B6E67] mt-1">Review everything before creating the client record.</p>
            </div>

            <div className="bg-[#222520] border border-[#2E3129] rounded-2xl divide-y divide-[#2E3129]">
              <div className="px-5 py-4">
                <div className="text-[10px] font-semibold text-[#6B6E67] uppercase tracking-wide mb-3">Client</div>
                <div className="flex items-center gap-3">
                  <Avatar firstName={form.first_name} lastName={form.last_name} src={null} size="md" />
                  <div>
                    <div className="text-sm font-semibold text-[#E8EBE4]">
                      {form.first_name} {form.last_name}
                    </div>
                    {form.phone && <div className="text-xs text-[#6B6E67]">{form.phone}</div>}
                    {form.email && <div className="text-xs text-[#6B6E67]">{form.email}</div>}
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 grid grid-cols-2 gap-3">
                <div className="text-[10px] font-semibold text-[#6B6E67] uppercase tracking-wide col-span-2 mb-1">Package</div>
                <div>
                  <div className="text-[10px] text-[#6B6E67]">Package</div>
                  <div className="text-sm text-[#E8EBE4]">{form.package_name || "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#6B6E67]">Price Paid</div>
                  <div className="text-sm font-semibold text-[#B9E84A]">₹{form.price_paid.toLocaleString("en-IN")}</div>
                </div>
                {form.sessions_total > 0 && (
                  <div>
                    <div className="text-[10px] text-[#6B6E67]">Sessions</div>
                    <div className="text-sm text-[#E8EBE4]">{form.sessions_total}</div>
                  </div>
                )}
                <div>
                  <div className="text-[10px] text-[#6B6E67]">Duration</div>
                  <div className="text-sm text-[#E8EBE4]">
                    {form.start_date}{form.end_date ? ` → ${form.end_date}` : ""}
                  </div>
                </div>
                {form.invoice_number && (
                  <div>
                    <div className="text-[10px] text-[#6B6E67]">Invoice</div>
                    <div className="text-sm text-[#E8EBE4]">{form.invoice_number}</div>
                  </div>
                )}
                {file && (
                  <div className="col-span-2">
                    <div className="text-[10px] text-[#6B6E67]">Bill</div>
                    <div className="flex items-center gap-1.5 text-sm text-[#9B9E96]">
                      <FileText size={12} />
                      <span className="truncate">{file.name}</span>
                      <span className="text-[#B9E84A] text-[10px]">· will be stored</span>
                    </div>
                  </div>
                )}
              </div>

              {selectedTrainer && (
                <div className="px-5 py-4">
                  <div className="text-[10px] font-semibold text-[#6B6E67] uppercase tracking-wide mb-3">Assignment</div>
                  <div className="flex items-center gap-3">
                    <Avatar firstName={selectedTrainer.first_name} lastName={selectedTrainer.last_name} src={selectedTrainer.profile_picture_url} size="sm" />
                    <div>
                      <div className="text-sm font-medium text-[#E8EBE4]">
                        {selectedTrainer.first_name} {selectedTrainer.last_name}
                      </div>
                      <div className="text-xs text-[#6B6E67]">
                        {form.days_of_week.map((d) => DAY_NAMES[d]).join(", ")} · {
                          (() => {
                            const [h, m] = form.preferred_time.split(":").map(Number);
                            const ampm = h >= 12 ? "PM" : "AM";
                            const h12 = h % 12 || 12;
                            return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
                          })()
                        }
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {submitError && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
                <X size={12} className="mt-0.5 flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="flex items-center gap-1.5 h-11 px-5 rounded-xl border border-[#2E3129] text-sm text-[#9B9E96] hover:bg-[#222520] transition-colors"
              >
                <ChevronLeft size={15} /> Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-[#B9E84A] text-[#171917] text-sm font-bold hover:bg-[#A8D63A] transition-colors disabled:opacity-50"
              >
                {submitting ? (
                  <><Loader2 size={15} className="animate-spin" /> Creating…</>
                ) : (
                  <><CheckCircle size={15} /> Create PT Client</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { formatDate, formatTime, DAY_NAMES_FULL } from "@/lib/utils";
import { Award } from "lucide-react";

export default async function TrainerProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const { data: trainer } = await supabase.from("trainers")
    .select("*, trainer_working_hours(*), trainer_commission_rules(*)")
    .eq("user_id", user.id)
    .single();

  if (!trainer) {
    return (
      <div className="px-8 py-16 text-center text-[#6B6E67]">Profile not found.</div>
    );
  }

  const workingHours = trainer.trainer_working_hours ?? [];

  return (
    <div>
      <Header title="My Profile" />
      <div className="px-8 py-6 space-y-5 max-w-3xl">
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <Avatar firstName={trainer.first_name} lastName={trainer.last_name} src={trainer.profile_picture_url} size="xl" />
            <div>
              <h2 className="text-lg font-semibold text-[#E8EBE4]">{trainer.first_name} {trainer.last_name}</h2>
              <p className="text-sm text-[#6B6E67]">{trainer.role_title}</p>
              <div className="mt-2"><StatusBadge status={trainer.status} /></div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {trainer.specializations?.map((s: string) => <Badge key={s} variant="outline">{s}</Badge>)}
              </div>
              {trainer.bio && <p className="mt-3 text-sm text-[#6B6E67] leading-relaxed">{trainer.bio}</p>}
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm pt-5 border-t border-[#1A1C18]">
            <div>
              <div className="text-xs text-[#6B6E67]">Experience</div>
              <div className="font-medium text-[#E8EBE4] mt-0.5">{trainer.experience_years} years</div>
            </div>
            <div>
              <div className="text-xs text-[#6B6E67]">Joined</div>
              <div className="font-medium text-[#E8EBE4] mt-0.5">{formatDate(trainer.joining_date)}</div>
            </div>
            <div>
              <div className="text-xs text-[#6B6E67]">Max Clients/Slot</div>
              <div className="font-bold text-[#E8EBE4] mt-0.5 text-base">{trainer.max_clients_per_slot}</div>
            </div>
            {trainer.certifications?.length > 0 && (
              <div className="col-span-2">
                <div className="text-xs text-[#6B6E67] mb-1">Certifications</div>
                <div className="flex flex-wrap gap-1">
                  {trainer.certifications.map((c: string) => (
                    <div key={c} className="flex items-center gap-1 text-xs text-[#6B6E67] bg-[#1A1C18] px-2 py-1 rounded">
                      <Award size={10} />{c}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-[#E8EBE4] mb-4">Working Hours</h3>
          <div className="space-y-2">
            {[...workingHours].sort((a: any, b: any) => a.day_of_week - b.day_of_week).map((wh: any) => (
              <div key={wh.id} className="flex items-center gap-4">
                <span className="text-xs text-[#6B6E67] w-12">{DAY_NAMES_FULL[wh.day_of_week].slice(0, 3)}</span>
                {wh.is_working_day ? (
                  <span className="text-sm text-[#E8EBE4]">{formatTime(wh.start_time)} – {formatTime(wh.end_time)}</span>
                ) : (
                  <span className="text-xs text-[#6B6E67]">Off</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Search, Star } from "lucide-react";

interface Trainer {
  id: string;
  first_name: string;
  last_name: string;
  role_title: string | null;
  specializations: string[] | null;
  joining_date: string | null;
  max_clients_per_slot: number;
  status: string;
  profile_picture_url: string | null;
}

interface Assignment { trainer_id: string }
interface Feedback { trainer_id: string; overall_rating: number | null }

export function TrainersTable({
  trainers,
  assignments,
  feedback,
}: {
  trainers: Trainer[];
  assignments: Assignment[];
  feedback: Feedback[];
}) {
  const [search, setSearch] = useState("");

  const filtered = trainers.filter(t => {
    const q = search.toLowerCase();
    return (
      !q ||
      t.first_name?.toLowerCase().includes(q) ||
      t.last_name?.toLowerCase().includes(q) ||
      t.role_title?.toLowerCase().includes(q) ||
      t.specializations?.some(s => s.toLowerCase().includes(q))
    );
  });

  const getClientCount = (trainerId: string) =>
    assignments.filter(a => a.trainer_id === trainerId).length;

  const getRating = (trainerId: string) => {
    const fb = feedback.filter(f => f.trainer_id === trainerId);
    if (!fb.length) return null;
    return (fb.reduce((s, f) => s + (f.overall_rating ?? 0), 0) / fb.length).toFixed(1);
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6E67]" />
        <input
          type="text"
          placeholder="Search trainers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 h-9 text-sm border border-[#2E3129] rounded-lg bg-[#222520] text-[#E8EBE4] placeholder:text-[#6B6E67] focus:outline-none focus:ring-2 focus:ring-[#B9E84A]/50"
        />
      </div>

      <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]">
            <thead>
              <tr className="border-b border-[#1A1C18]">
                {["Trainer", "Specializations", "Joined", "Clients", "Rating", "Status", ""].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold text-[#6B6E67] uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(trainer => {
                const rating = getRating(trainer.id);
                const clientCount = getClientCount(trainer.id);
                return (
                  <tr key={trainer.id} className="border-b border-[#1A1C18] last:border-0 hover:bg-[#2E3129] transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          firstName={trainer.first_name}
                          lastName={trainer.last_name}
                          src={trainer.profile_picture_url}
                          size="sm"
                        />
                        <div>
                          <div className="text-sm font-medium text-[#E8EBE4]">
                            {trainer.first_name} {trainer.last_name}
                          </div>
                          <div className="text-[10px] text-[#6B6E67]">{trainer.role_title}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {trainer.specializations?.slice(0, 2).map(s => (
                          <Badge key={s} variant="outline">{s}</Badge>
                        ))}
                        {(trainer.specializations?.length ?? 0) > 2 && (
                          <span className="text-[10px] text-[#6B6E67]">+{trainer.specializations!.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-[#6B6E67]">
                      {trainer.joining_date ? formatDate(trainer.joining_date) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-sm font-semibold text-[#E8EBE4] tabular-nums">{clientCount}</span>
                      <span className="text-xs text-[#6B6E67]">/{trainer.max_clients_per_slot}</span>
                    </td>
                    <td className="px-5 py-3">
                      {rating ? (
                        <div className="flex items-center gap-1">
                          <Star size={11} className="text-amber-400 fill-amber-400" />
                          <span className="text-sm text-[#E8EBE4]">{rating}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-[#6B6E67]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={trainer.status} />
                    </td>
                    <td className="px-5 py-3">
                      <a
                        href={`/manager/trainers/${trainer.id}`}
                        className="text-xs text-[#6B6E67] hover:text-[#E8EBE4] transition-colors"
                      >
                        View
                      </a>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-[#6B6E67]">
                    {search ? "No trainers match your search" : "No trainers yet"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { formatTime } from "@/lib/utils";
import { Search, Star, Pencil } from "lucide-react";

interface TodayInfo {
  isOnLeave: boolean;
  isWorking: boolean;
  workStart: string | null;
  workEnd: string | null;
  totalSlots: number;
  occupiedSlots: number;
  nextPt: { time: string; clientName: string } | null;
}

interface Trainer {
  id: string;
  first_name: string;
  last_name: string;
  role_title: string | null;
  specializations: string[] | null;
  status: string;
  profile_picture_url: string | null;
  phone: string | null;
  email: string | null;
  activeClientCount: number;
  rating: string | null;
  today: TodayInfo;
}

export function TrainersTable({ trainers }: { trainers: Trainer[] }) {
  const [search, setSearch] = useState("");

  const filtered = trainers.filter(t => {
    const q = search.toLowerCase();
    return (
      !q ||
      t.first_name?.toLowerCase().includes(q) ||
      t.last_name?.toLowerCase().includes(q) ||
      t.role_title?.toLowerCase().includes(q) ||
      t.specializations?.some(s => s.toLowerCase().includes(q)) ||
      (t.phone ?? "").includes(q) ||
      (t.email ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6E67]" />
        <input
          type="text"
          placeholder="Name, phone, email, specialization…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 h-9 text-sm border border-[#2E3129] rounded-lg bg-[#222520] text-[#E8EBE4] placeholder:text-[#6B6E67] focus:outline-none focus:ring-2 focus:ring-[#B9E84A]/50"
        />
      </div>

      <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-[#1A1C18]">
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#6B6E67] uppercase tracking-wide w-64">Trainer</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#6B6E67] uppercase tracking-wide">Today</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#6B6E67] uppercase tracking-wide w-32">Clients</th>
                <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#6B6E67] uppercase tracking-wide w-24">Status</th>
                <th className="px-5 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(trainer => {
                const { today } = trainer;
                return (
                  <tr key={trainer.id} className="border-b border-[#1A1C18] last:border-0 hover:bg-[#2A2D28] transition-colors">

                    {/* Trainer identity */}
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <Avatar
                          firstName={trainer.first_name}
                          lastName={trainer.last_name}
                          src={trainer.profile_picture_url}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-[#E8EBE4] truncate">
                            {trainer.first_name} {trainer.last_name}
                          </div>
                          {trainer.phone && (
                            <div className="text-[10px] text-[#6B6E67] mt-0.5 tabular-nums">{trainer.phone}</div>
                          )}
                          {trainer.specializations && trainer.specializations.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {trainer.specializations.slice(0, 2).map(s => (
                                <span key={s} className="text-[9px] text-[#9B9E96] bg-[#2E3129] px-1.5 py-0.5 rounded">
                                  {s}
                                </span>
                              ))}
                              {trainer.specializations.length > 2 && (
                                <span className="text-[9px] text-[#6B6E67]">+{trainer.specializations.length - 2}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Today status */}
                    <td className="px-5 py-4">
                      {today.isOnLeave ? (
                        <span className="inline-flex items-center text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                          On Leave
                        </span>
                      ) : today.isWorking && today.workStart && today.workEnd ? (
                        <div className="space-y-0.5">
                          <div className="text-xs text-[#E8EBE4] font-medium tabular-nums">
                            {formatTime(today.workStart)} – {formatTime(today.workEnd)}
                          </div>
                          <div className="text-[10px] text-[#9B9E96]">
                            {today.occupiedSlots}/{today.totalSlots} slots booked
                          </div>
                          {today.nextPt ? (
                            <div className="text-[10px] text-[#B9E84A] tabular-nums">
                              Next: {formatTime(today.nextPt.time)}
                              {today.nextPt.clientName && (
                                <span className="text-[#9B9E96] not-italic"> — {today.nextPt.clientName}</span>
                              )}
                            </div>
                          ) : today.totalSlots > 0 ? (
                            <div className="text-[10px] text-[#4A4D47]">No sessions remaining today</div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-[10px] text-[#4A4D47]">Off today</span>
                      )}
                    </td>

                    {/* Clients + Rating */}
                    <td className="px-5 py-4">
                      <div className="space-y-0.5">
                        <div>
                          <span className="text-sm font-semibold text-[#E8EBE4] tabular-nums">{trainer.activeClientCount}</span>
                          <span className="text-[10px] text-[#6B6E67] ml-1">active</span>
                        </div>
                        {trainer.rating && (
                          <div className="flex items-center gap-1">
                            <Star size={10} className="text-amber-400 fill-amber-400" />
                            <span className="text-[10px] text-[#9B9E96]">{trainer.rating}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <StatusBadge status={trainer.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/manager/trainers/${trainer.id}`}
                          className="text-xs text-[#9B9E96] hover:text-[#E8EBE4] transition-colors"
                        >
                          View
                        </Link>
                        <Link
                          href={`/manager/trainers/${trainer.id}/edit`}
                          className="flex items-center gap-1 text-xs text-[#9B9E96] hover:text-[#E8EBE4] transition-colors"
                        >
                          <Pencil size={10} />
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center">
                    <div className="text-sm text-[#9B9E96]">
                      {search ? "No trainers match your search" : "No trainers yet"}
                    </div>
                    {!search && (
                      <a
                        href="/manager/trainers/new"
                        className="mt-2 inline-block text-xs text-[#B9E84A] hover:underline"
                      >
                        Add your first trainer →
                      </a>
                    )}
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

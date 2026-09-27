"use client";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { formatDate, formatTime } from "@/lib/utils";
import { Search, ChevronRight } from "lucide-react";
import Link from "next/link";

interface Props {
  clients: any[];
  today: string;
}

export function TrainerClientsTable({ clients, today }: Props) {
  const [search, setSearch] = useState("");

  const filtered = clients.filter(c => {
    const name = `${c.pt_clients?.first_name ?? ""} ${c.pt_clients?.last_name ?? ""}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6E67]" />
        <input
          type="text"
          placeholder="Search clients..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-[#2E3129] rounded-xl bg-[#222520] focus:outline-none focus:ring-2 focus:ring-[#B9E84A]/40 focus:border-[#B9E84A] text-[#E8EBE4] placeholder-[#9B9E96]"
        />
      </div>

      {!filtered.length ? (
        <div className="py-16 text-center text-sm text-[#6B6E67]">
          {search ? "No clients match your search." : "No clients assigned yet."}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((a: any) => {
            const client = a.pt_clients;
            const totalSessions = a.total_sessions ?? client?.total_sessions ?? 0;
            const remaining = Math.max(0, totalSessions - a.completedCount);
            const next = a.nextSession;
            const isToday = next?.session_date === today;

            return (
              <Link key={a.id} href={`/trainer/clients/${a.client_id}`}>
                <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-4 flex items-center gap-3 hover:border-[#B9E84A]/50 transition-colors active:bg-[#1A1C18]">
                  <Avatar firstName={client?.first_name ?? "?"} lastName={client?.last_name ?? ""} src={client?.profile_picture_url} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#E8EBE4]">{client?.first_name} {client?.last_name}</div>
                    <div className="text-xs text-[#6B6E67] mt-0.5 truncate">{client?.goal}</div>
                    {totalSessions > 0 && (
                      <div className="text-xs text-[#6B6E67] mt-1">{remaining} session{remaining !== 1 ? "s" : ""} remaining</div>
                    )}
                    {next && (
                      <div className="text-xs font-medium mt-1 text-[#B9E84A]">
                        Next: {isToday ? "Today" : formatDate(next.session_date)} · {formatTime(next.start_time)}
                      </div>
                    )}
                    {!next && <div className="text-xs text-[#6B6E67] mt-1">No upcoming sessions</div>}
                  </div>
                  <ChevronRight size={16} className="text-[#D5D7D0] flex-shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

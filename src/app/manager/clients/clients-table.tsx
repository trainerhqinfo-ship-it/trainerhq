"use client";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Search } from "lucide-react";

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  start_date: string | null;
  goal: string | null;
}

interface Assignment {
  client_id: string;
  trainers: { first_name: string; last_name: string } | null;
}

export function ClientsTable({ clients, assignments }: { clients: Client[]; assignments: Assignment[] }) {
  const [search, setSearch] = useState("");

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return (
      !q ||
      c.first_name?.toLowerCase().includes(q) ||
      c.last_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    );
  });

  const getTrainer = (clientId: string) => {
    const a = assignments.find(a => a.client_id === clientId);
    return a?.trainers ?? null;
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6E67]" />
        <input
          type="text"
          placeholder="Search clients..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 h-9 text-sm border border-[#2E3129] rounded-lg bg-[#222520] text-[#E8EBE4] placeholder:text-[#6B6E67] focus:outline-none focus:ring-2 focus:ring-[#B9E84A]/50"
        />
      </div>

      <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-[#1A1C18]">
                {["Client", "Contact", "Joined", "Trainer", "Status"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold text-[#6B6E67] uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(client => {
                const trainer = getTrainer(client.id);
                return (
                  <tr key={client.id} className="border-b border-[#1A1C18] last:border-0 hover:bg-[#2E3129] transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar firstName={client.first_name} lastName={client.last_name} size="sm" />
                        <div>
                          <div className="text-sm font-medium text-[#E8EBE4]">
                            {client.first_name} {client.last_name}
                          </div>
                          {client.goal && (
                            <div className="text-[10px] text-[#6B6E67] truncate max-w-[160px]">{client.goal}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-xs text-[#E8EBE4]">{client.email ?? "—"}</div>
                      <div className="text-[10px] text-[#6B6E67]">{client.phone ?? ""}</div>
                    </td>
                    <td className="px-5 py-3 text-xs text-[#6B6E67]">
                      {client.start_date ? formatDate(client.start_date) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      {trainer ? (
                        <div className="text-xs text-[#E8EBE4]">
                          {trainer.first_name} {trainer.last_name}
                        </div>
                      ) : (
                        <span className="text-xs text-[#6B6E67]">Unassigned</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={client.status} />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-[#6B6E67]">
                    {search ? "No clients match your search" : "No clients yet"}
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

"use client";
import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Search } from "lucide-react";

interface PackageInfo {
  package_name: string | null;
  total_sessions: number | null;
  amount_collected: number | null;
  package_value: number | null;
  end_date: string | null;
}

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  joining_date: string | null;
  goal: string | null;
  pkg: PackageInfo | null;
  sessionsCompleted: number;
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
      c.phone?.includes(q) ||
      c.pkg?.package_name?.toLowerCase().includes(q)
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
          placeholder="Name, phone, email, package…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 h-9 text-sm border border-[#2E3129] rounded-lg bg-[#222520] text-[#E8EBE4] placeholder:text-[#6B6E67] focus:outline-none focus:ring-2 focus:ring-[#B9E84A]/50"
        />
      </div>

      <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-[#1A1C18]">
                {["Client", "Package", "Sessions", "Amount Paid", "Trainer", "Status"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold text-[#6B6E67] uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(client => {
                const trainer = getTrainer(client.id);
                const pkg = client.pkg;
                const remaining = pkg?.total_sessions != null
                  ? Math.max(0, pkg.total_sessions - client.sessionsCompleted)
                  : null;

                return (
                  <tr key={client.id} className="border-b border-[#1A1C18] last:border-0 hover:bg-[#2E3129] transition-colors">
                    {/* Client */}
                    <td className="px-5 py-3">
                      <Link href={`/manager/clients/${client.id}`} className="flex items-center gap-2.5 group">
                        <Avatar firstName={client.first_name} lastName={client.last_name} size="sm" />
                        <div>
                          <div className="text-sm font-medium text-[#E8EBE4] group-hover:text-[#B9E84A] transition-colors">
                            {client.first_name} {client.last_name}
                          </div>
                          {client.phone && (
                            <div className="text-[10px] text-[#6B6E67] tabular-nums">{client.phone}</div>
                          )}
                          {client.joining_date && (
                            <div className="text-[10px] text-[#4A4D47]">Joined {formatDate(client.joining_date)}</div>
                          )}
                        </div>
                      </Link>
                    </td>

                    {/* Package */}
                    <td className="px-5 py-3">
                      {pkg ? (
                        <div>
                          <div className="text-xs text-[#E8EBE4]">{pkg.package_name ?? "—"}</div>
                          {pkg.end_date && (
                            <div className="text-[10px] text-[#6B6E67]">Ends {formatDate(pkg.end_date)}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[#4A4D47]">—</span>
                      )}
                    </td>

                    {/* Sessions */}
                    <td className="px-5 py-3">
                      {pkg?.total_sessions != null ? (
                        <div>
                          <div className="text-xs font-medium text-[#E8EBE4] tabular-nums">
                            {client.sessionsCompleted}/{pkg.total_sessions}
                          </div>
                          <div className="text-[10px] text-[#6B6E67]">{remaining} left</div>
                        </div>
                      ) : (
                        <span className="text-xs text-[#4A4D47]">—</span>
                      )}
                    </td>

                    {/* Amount Paid */}
                    <td className="px-5 py-3">
                      {pkg?.amount_collected != null ? (
                        <div className="text-sm font-semibold text-[#B9E84A] tabular-nums">
                          ₹{pkg.amount_collected.toLocaleString("en-IN")}
                        </div>
                      ) : (
                        <span className="text-xs text-[#4A4D47]">—</span>
                      )}
                    </td>

                    {/* Trainer */}
                    <td className="px-5 py-3">
                      {trainer ? (
                        <div className="text-xs text-[#E8EBE4]">
                          {trainer.first_name} {trainer.last_name}
                        </div>
                      ) : (
                        <span className="text-xs text-[#6B6E67]">Unassigned</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3">
                      <StatusBadge status={client.status} />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-[#6B6E67]">
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

"use client";
import { useState } from "react";

export interface CapacityHour { hour: number; occupied: number; total: number; }

const ALL_HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM – 10 PM

function fmt(h: number) {
  if (h === 12) return "12 PM";
  if (h === 0)  return "12 AM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

export function PeakHoursChart({ data }: { data: CapacityHour[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const map: Record<number, CapacityHour> = {};
  data.forEach(d => { map[d.hour] = d; });

  const maxOccupied = Math.max(...data.map(d => d.occupied), 1);
  const hasData = data.some(d => d.total > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-36 text-sm text-[#6B6E67]">
        No PT capacity scheduled today
      </div>
    );
  }

  const hovData = hovered !== null ? map[hovered] : null;
  const hovUtil = hovData && hovData.total > 0
    ? Math.round((hovData.occupied / hovData.total) * 100)
    : null;

  return (
    <div className="relative select-none">
      {/* Tooltip */}
      {hovered !== null && hovData && hovData.total > 0 && (
        <div className="absolute top-0 right-0 bg-[#1E201C] border border-[#3A3D35] rounded-xl px-3 py-2.5 z-10 pointer-events-none shadow-lg min-w-[150px]">
          <p className="text-[10px] text-[#9B9E96] mb-0.5">{fmt(hovered)} – {fmt(hovered + 1)}</p>
          <p className="text-sm font-bold text-[#B9E84A]">{hovData.occupied}/{hovData.total} occupied</p>
          <p className="text-[10px] text-[#9B9E96] mt-0.5">{hovUtil}% utilization</p>
        </div>
      )}

      {/* Bar chart */}
      <div className="flex items-end gap-[3px]" style={{ height: 140 }}>
        {ALL_HOURS.map(h => {
          const d = map[h];
          const total    = d?.total    ?? 0;
          const occupied = d?.occupied ?? 0;
          const active   = hovered === h;
          const util     = total > 0 ? occupied / total : 0;
          // bar height normalised against highest occupied count so relative volume is visible
          const pct = total > 0 ? Math.max(occupied / maxOccupied, 0.03) : 0;

          const barColor = active
            ? "#B9E84A"
            : util >= 0.9 ? "rgba(248,113,113,0.65)"
            : util >= 0.7 ? "rgba(251,146,60,0.55)"
            : total > 0   ? "rgba(185,232,74,0.45)"
            : "rgba(46,49,41,0.4)";

          return (
            <div
              key={h}
              className="flex-1 flex flex-col items-center justify-end"
              style={{ height: "100%", cursor: total > 0 ? "pointer" : "default" }}
              onMouseEnter={() => setHovered(h)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Count label above hovered bar */}
              <span
                className="text-[10px] font-bold mb-1 transition-opacity duration-100"
                style={{ opacity: active && total > 0 ? 1 : 0, color: "#B9E84A" }}
              >
                {occupied}/{total}
              </span>

              {/* Bar */}
              <div
                className="w-full rounded-t-[3px] transition-all duration-150"
                style={{
                  height: total > 0 ? `${pct * 100}%` : 2,
                  backgroundColor: barColor,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex gap-[3px] mt-2">
        {ALL_HOURS.map(h => (
          <div key={h} className="flex-1 text-center">
            {h % 4 === 2 || h === 6 || h === 22 ? (
              <span
                className="text-[9px]"
                style={{ color: hovered === h ? "#B9E84A" : "#6B6E67" }}
              >
                {fmt(h)}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";

interface HourBucket { hour: number; count: number; }

const ALL_HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM – 10 PM

function fmt(h: number) {
  if (h === 12) return "12 PM";
  if (h === 0)  return "12 AM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

export function PeakHoursChart({ data }: { data: HourBucket[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const map: Record<number, number> = {};
  data.forEach(d => { map[d.hour] = d.count; });
  const max = Math.max(...ALL_HOURS.map(h => map[h] ?? 0), 1);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-36 text-sm text-[#6B6E67]">
        No sessions scheduled today
      </div>
    );
  }

  const hovCount = hovered !== null ? (map[hovered] ?? 0) : null;

  return (
    <div className="relative select-none">
      {/* Tooltip */}
      {hovered !== null && (
        <div className="absolute top-0 right-0 bg-[#1E201C] border border-[#3A3D35] rounded-xl px-3 py-2 z-10 pointer-events-none shadow-lg min-w-[110px]">
          <p className="text-[10px] text-[#9B9E96] mb-0.5">{fmt(hovered)} – {fmt(hovered + 1)}</p>
          <p className="text-sm font-bold text-[#B9E84A]">{hovCount} session{hovCount !== 1 ? "s" : ""}</p>
        </div>
      )}

      {/* Bar chart */}
      <div className="flex items-end gap-[3px]" style={{ height: 140 }}>
        {ALL_HOURS.map(h => {
          const count = map[h] ?? 0;
          const pct   = count / max;
          const active = hovered === h;

          return (
            <div
              key={h}
              className="flex-1 flex flex-col items-center justify-end"
              style={{ height: "100%", cursor: "pointer" }}
              onMouseEnter={() => setHovered(h)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Count label above hovered bar */}
              <span
                className="text-[10px] font-bold mb-1 transition-opacity duration-100"
                style={{
                  opacity: active && count > 0 ? 1 : 0,
                  color: "#B9E84A",
                }}
              >
                {count}
              </span>

              {/* Bar */}
              <div
                className="w-full rounded-t-[3px] transition-all duration-150"
                style={{
                  height: count > 0 ? `${Math.max(pct * 100, 4)}%` : 2,
                  backgroundColor: active
                    ? "#B9E84A"
                    : count > 0
                    ? "rgba(185,232,74,0.4)"
                    : "rgba(46,49,41,0.5)",
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

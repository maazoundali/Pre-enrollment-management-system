"use client"

import { useState } from "react"

interface Bar { label: string; value: number; max: number; color: string; sub?: string }
interface Props { data: Bar[]; title?: string }

export default function BarChart({ data, title }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div>
      {title && (
        <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#475569", marginBottom: "18px" }}>
          {title}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {data.map((bar) => {
          const pct        = bar.max > 0 ? Math.min((bar.value / bar.max) * 100, 100) : 0
          const isCritical = pct > 80
          const isHot      = pct > 60
          const barColor   = isCritical ? "#f87171" : isHot ? "#f5c842" : bar.color
          const isHov      = hovered === bar.label

          return (
            <div
              key={bar.label}
              onMouseEnter={() => setHovered(bar.label)}
              onMouseLeave={() => setHovered(null)}
              style={{ padding: "10px 12px", borderRadius: "12px", background: isHov ? "rgba(255,255,255,0.03)" : "transparent", border: isHov ? "1px solid rgba(255,255,255,0.06)" : "1px solid transparent", transition: "all 0.2s ease" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "9px" }}>
                <span style={{ fontSize: "12.5px", color: isHov ? "#cbd5e1" : "#94a3b8", fontWeight: isHov ? 600 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "55%", flex: 1, transition: "color 0.15s" }}>
                  {bar.label}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "7px", flexShrink: 0 }}>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: barColor }}>{bar.value}</span>
                  {bar.sub && <span style={{ fontSize: "11px", color: "#334155" }}>{bar.sub}</span>}
                  <span style={{
                    fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "20px",
                    background: `${barColor}1a`, color: barColor,
                    boxShadow: isHov ? `0 0 8px ${barColor}33` : "none",
                    transition: "box-shadow 0.2s",
                  }}>
                    {Math.round(pct)}%
                  </span>
                </div>
              </div>

              {/* Track */}
              <div style={{ height: "8px", borderRadius: "99px", background: "rgba(255,255,255,0.06)", overflow: "hidden", position: "relative" }}>
                {/* Fill */}
                <div style={{
                  width: `${pct}%`, height: "100%", borderRadius: "99px",
                  background: isCritical
                    ? "linear-gradient(90deg, #ef4444, #f87171)"
                    : isHot
                      ? "linear-gradient(90deg, #e8a820, #f5c842)"
                      : `linear-gradient(90deg, ${barColor}88, ${barColor})`,
                  boxShadow: `0 0 12px ${barColor}55`,
                  transition: "width 1.1s cubic-bezier(0.4, 0, 0.2, 1)",
                  position: "relative",
                }}/>
              </div>

              {/* Capacity label when full */}
              {isCritical && (
                <div style={{ marginTop: "5px", fontSize: "10px", color: "#f87171", fontWeight: 600, opacity: 0.85 }}>
                  {bar.max > 0 && bar.value >= bar.max ? "Complet" : `${Math.round(pct)}% rempli`}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

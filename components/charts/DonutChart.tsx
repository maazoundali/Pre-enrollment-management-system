"use client"

import { useState } from "react"

interface Slice { label: string; value: number; color: string }
interface Props  { data: Slice[]; size?: number; title?: string }

export default function DonutChart({ data, size = 200, title }: Props) {
  const [hovered, setHovered] = useState<number | null>(null)
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null

  const R   = size / 2
  const r   = R * 0.58
  const cx  = R
  const cy  = R
  const GAP = 0.035

  const slices: { path: string; color: string; label: string; value: number; pct: number }[] = []
  let angle = -Math.PI / 2

  data.forEach((slice) => {
    if (slice.value === 0) return
    const sweep       = (slice.value / total) * Math.PI * 2
    const actualSweep = Math.max(sweep - GAP, 0.01)
    const s0 = angle + GAP / 2
    const s1 = s0 + actualSweep
    const x1 = cx + R * Math.cos(s0); const y1 = cy + R * Math.sin(s0)
    const x2 = cx + R * Math.cos(s1); const y2 = cy + R * Math.sin(s1)
    const xi1 = cx + r * Math.cos(s0); const yi1 = cy + r * Math.sin(s0)
    const xi2 = cx + r * Math.cos(s1); const yi2 = cy + r * Math.sin(s1)
    const large = actualSweep > Math.PI ? 1 : 0
    const path = [
      `M ${x1} ${y1}`,
      `A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`,
      `L ${xi2} ${yi2}`,
      `A ${r} ${r} 0 ${large} 0 ${xi1} ${yi1}`,
      "Z",
    ].join(" ")
    slices.push({ path, color: slice.color, label: slice.label, value: slice.value, pct: Math.round((slice.value / total) * 100) })
    angle += sweep
  })

  const hov = hovered !== null ? slices[hovered] : null

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "28px", flexWrap: "wrap", width: "100%" }}>
      {/* SVG donut */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <svg
          width={size} height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ overflow: "visible", filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.5))" }}
        >
          <defs>
            {slices.map((s, i) => (
              <filter key={i} id={`glow-d-${i}`} x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            ))}
            <radialGradient id="center-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="rgba(15,25,50,0.95)"/>
              <stop offset="100%" stopColor="rgba(7,14,32,0.98)"/>
            </radialGradient>
          </defs>

          {/* Center fill circle */}
          <circle cx={cx} cy={cy} r={r - 2} fill="url(#center-bg)"/>

          {/* Slices */}
          {slices.map((s, i) => (
            <path
              key={i}
              d={s.path}
              fill={s.color}
              opacity={hovered === null ? 0.88 : hovered === i ? 1 : 0.28}
              filter={hovered === i ? `url(#glow-d-${i})` : undefined}
              style={{
                cursor: "pointer",
                transition: "opacity 0.2s ease, transform 0.25s ease",
                transformOrigin: `${cx}px ${cy}px`,
                transform: hovered === i ? "scale(1.06)" : "scale(1)",
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}

          {/* Center label */}
          <text x={cx} y={cy - 14} textAnchor="middle"
            fill={hov ? hov.color : "#475569"}
            fontSize="8.5" fontWeight="700" letterSpacing="1.2"
            style={{ transition: "fill 0.2s", textTransform: "uppercase" }}>
            {hov ? hov.label.toUpperCase().slice(0, 14) : (title ?? "").toUpperCase()}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle"
            fill={hov ? hov.color : "#f1f5f9"}
            fontSize="24" fontWeight="800"
            style={{ transition: "fill 0.2s" }}>
            {hov ? hov.value : total}
          </text>
          {hov && (
            <text x={cx} y={cy + 24} textAnchor="middle" fill={hov.color} fontSize="10" fontWeight="600" opacity="0.75">
              {hov.pct}%
            </text>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
        {slices.map((s, i) => (
          <div
            key={s.label}
            style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "6px 10px", borderRadius: "10px", cursor: "pointer",
              background: hovered === i ? `${s.color}14` : "transparent",
              border: hovered === i ? `1px solid ${s.color}30` : "1px solid transparent",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <div style={{
              width: "9px", height: "9px", borderRadius: "3px", background: s.color, flexShrink: 0,
              boxShadow: hovered === i ? `0 0 8px ${s.color}` : "none",
              transition: "box-shadow 0.2s",
            }}/>
            <div style={{
              fontSize: "12px", flex: 1,
              color: hovered === i ? "#f1f5f9" : "#64748b",
              fontWeight: hovered === i ? 600 : 400,
              transition: "color 0.15s",
            }}>
              {s.label}
            </div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: s.color, minWidth: "22px", textAlign: "right" }}>{s.value}</div>
            <div style={{ fontSize: "10px", color: "#334155", minWidth: "32px", textAlign: "right" }}>{s.pct}%</div>
          </div>
        ))}
      </div>
    </div>
  )
}

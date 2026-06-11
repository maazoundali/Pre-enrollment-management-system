"use client"

import { useEffect, useState } from "react"
import { useI18n } from "@/lib/i18n-context"
import { computeEnrollment, type EnrollmentStatus } from "@/lib/enrollment"

// Module-level cache — fetched once per session, shared across all banner instances
let _cached: EnrollmentStatus | null = null
let _promise: Promise<void> | null = null

function fetchEnrollment(): Promise<void> {
  if (_promise) return _promise
  _promise = fetch("/api/parametres")
    .then((r) => r.json())
    .then((d) => { _cached = computeEnrollment(d.params ?? {}) })
    .catch(() => {})
  return _promise
}

interface Props {
  /** compact = small inline strip; full = full card (for landing page) */
  variant?: "compact" | "full"
}

export default function EnrollmentBanner({ variant = "compact" }: Props) {
  const { t, locale } = useI18n()
  const [status, setStatus] = useState<EnrollmentStatus | null>(null)

  useEffect(() => {
    if (_cached) { setStatus(_cached); return }
    fetchEnrollment().then(() => { if (_cached) setStatus(_cached) })
  }, [])

  if (!status) return null

  // If open and no end date configured → don't show anything (no news is good news)
  if (status.isOpen && status.daysLeft === null) return null

  const fmt = (d: Date | null) =>
    d ? d.toLocaleDateString(locale === "ar" ? "ar-TN" : locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric" }) : ""

  if (status.isOpen) {
    // Open with a deadline coming up — show a deadline reminder
    const urgent = (status.daysLeft ?? 99) <= 7
    if (variant === "compact") {
      return (
        <div style={{
          padding: "10px 16px", borderRadius: "12px", marginBottom: "20px",
          background: urgent ? "rgba(248,113,113,0.08)" : "rgba(245,200,66,0.07)",
          border: urgent ? "1px solid rgba(248,113,113,0.25)" : "1px solid rgba(245,200,66,0.2)",
          display: "flex", alignItems: "center", gap: "10px",
          fontSize: "13px",
        }}>
          <span style={{ fontSize: "16px" }}>{urgent ? "⚠️" : "📅"}</span>
          <span style={{ color: urgent ? "#fca5a5" : "#f5c842" }}>
            {urgent
              ? t("enrollment.closingSoon", { days: String(status.daysLeft) })
              : t("enrollment.deadline", { date: fmt(status.fin) })}
          </span>
        </div>
      )
    }
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "5px 14px", borderRadius: "20px", background: urgent ? "rgba(248,113,113,0.09)" : "rgba(245,200,66,0.09)", border: urgent ? "1px solid rgba(248,113,113,0.25)" : "1px solid rgba(245,200,66,0.22)" }}>
        <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: urgent ? "#f87171" : "#f5c842", animation: "pulse 2s ease-in-out infinite" }}/>
        <span style={{ fontSize: "12px", color: urgent ? "#fca5a5" : "#f5c842", fontWeight: 600 }}>
          {urgent
            ? t("enrollment.closingSoon", { days: String(status.daysLeft) })
            : t("enrollment.deadline", { date: fmt(status.fin) })}
        </span>
      </div>
    )
  }

  if (status.notYetOpen) {
    const msg = status.debut
      ? t("enrollment.opensOn", { date: fmt(status.debut) })
      : t("enrollment.notYetOpen")
    if (variant === "compact") {
      return (
        <div style={{ padding: "14px 18px", borderRadius: "12px", marginBottom: "20px", background: "rgba(96,165,250,0.07)", border: "1px solid rgba(96,165,250,0.2)", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px" }}>⏳</span>
          <span style={{ fontSize: "13px", color: "#60a5fa" }}>{msg}</span>
        </div>
      )
    }
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "5px 14px", borderRadius: "20px", background: "rgba(96,165,250,0.09)", border: "1px solid rgba(96,165,250,0.22)" }}>
        <span style={{ fontSize: "12px", color: "#60a5fa", fontWeight: 600 }}>⏳ {msg}</span>
      </div>
    )
  }

  // Closed
  const msg = status.fin && new Date() > status.fin
    ? t("enrollment.closedOn", { date: fmt(status.fin) })
    : t("enrollment.closed")

  if (variant === "compact") {
    return (
      <div style={{ padding: "14px 18px", borderRadius: "12px", marginBottom: "20px", background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)", display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "16px" }}>🔒</span>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#f87171" }}>{t("enrollment.closedTitle")}</div>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>{msg}</div>
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "5px 14px", borderRadius: "20px", background: "rgba(248,113,113,0.09)", border: "1px solid rgba(248,113,113,0.22)" }}>
      <span style={{ fontSize: "12px", color: "#f87171", fontWeight: 600 }}>🔒 {msg}</span>
    </div>
  )
}

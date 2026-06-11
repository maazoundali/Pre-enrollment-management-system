"use client"

import { useState } from "react"
import { useI18n } from "@/lib/i18n-context"

export default function AdminParametresPage() {
  const { t } = useI18n()
  const [reminderSending, setReminderSending] = useState(false)
  const [reminderResult,  setReminderResult]  = useState<{ sent?: number; total?: number; skipped?: boolean; hoursUntilEnd?: number; error?: string } | null>(null)

  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "32px 36px" }}>
      <div style={{ marginBottom: "36px" }}>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#f8fafc", margin: "0 0 6px" }}>
          {t("admin.parametres.title")}
        </h1>
        <p style={{ fontSize: "13px", color: "#64748b" }}>{t("admin.parametres.subtitle")}</p>
      </div>

      <div style={{ maxWidth: "640px", display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* Deadline reminders */}
        <div style={{ padding: "28px 32px", borderRadius: "20px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "18px", fontWeight: 500, color: "#f8fafc", margin: "0 0 6px" }}>
            {t("admin.parametres.reminders.title")}
          </h2>
          <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "20px" }}>
            {t("admin.parametres.reminders.desc")}
          </p>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={async () => {
                setReminderSending(true); setReminderResult(null)
                try {
                  const res = await fetch("/api/admin/send-reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force: false }) })
                  const data = await res.json()
                  if (!res.ok) setReminderResult({ error: data.error ?? t("common.error") })
                  else setReminderResult(data)
                } catch { setReminderResult({ error: t("common.error") }) }
                finally { setReminderSending(false) }
              }}
              disabled={reminderSending}
              style={{ padding: "10px 20px", borderRadius: "10px", border: "1px solid rgba(245,200,66,0.3)", background: "rgba(245,200,66,0.08)", color: "#f5c842", fontSize: "13px", fontWeight: 600, cursor: reminderSending ? "not-allowed" : "pointer", fontFamily: "inherit" }}
            >
              {reminderSending ? t("common.saving") : t("admin.parametres.reminders.sendBtn")}
            </button>
            <button
              onClick={async () => {
                if (!confirm(t("admin.parametres.reminders.forceConfirm"))) return
                setReminderSending(true); setReminderResult(null)
                try {
                  const res = await fetch("/api/admin/send-reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ force: true }) })
                  const data = await res.json()
                  if (!res.ok) setReminderResult({ error: data.error ?? t("common.error") })
                  else setReminderResult(data)
                } catch { setReminderResult({ error: t("common.error") }) }
                finally { setReminderSending(false) }
              }}
              disabled={reminderSending}
              style={{ padding: "10px 20px", borderRadius: "10px", border: "1px solid rgba(248,113,113,0.25)", background: "rgba(248,113,113,0.07)", color: "#f87171", fontSize: "13px", fontWeight: 600, cursor: reminderSending ? "not-allowed" : "pointer", fontFamily: "inherit" }}
            >
              {t("admin.parametres.reminders.forceBtn")}
            </button>
          </div>
          {reminderResult && (
            <div style={{ marginTop: "14px", padding: "12px 16px", borderRadius: "10px", background: reminderResult.error ? "rgba(239,68,68,0.1)" : reminderResult.skipped ? "rgba(245,200,66,0.08)" : "rgba(74,222,128,0.08)", border: reminderResult.error ? "1px solid rgba(239,68,68,0.25)" : reminderResult.skipped ? "1px solid rgba(245,200,66,0.2)" : "1px solid rgba(74,222,128,0.2)", fontSize: "13px", color: reminderResult.error ? "#fca5a5" : reminderResult.skipped ? "#f5c842" : "#4ade80" }}>
              {reminderResult.error
                ? t("admin.parametres.reminders.resultError", { error: reminderResult.error })
                : reminderResult.skipped
                  ? t("admin.parametres.reminders.resultSkipped", { hours: String(reminderResult.hoursUntilEnd ?? 0) })
                  : t("admin.parametres.reminders.resultSent", { sent: String(reminderResult.sent ?? 0), total: String(reminderResult.total ?? 0) })
              }
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

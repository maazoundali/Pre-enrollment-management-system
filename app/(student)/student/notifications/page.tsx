"use client"

import { useEffect, useState } from "react"
import { useI18n } from "@/lib/i18n-context"

interface Notification {
  id: string; type: string; message: string
  dateEnvoi: string; lu: boolean
}

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  DOSSIER_INCOMPLET: { icon: "⚠️", color: "#f5c842" },
  RECOMMANDATION:    { icon: "🤖", color: "#60a5fa" },
  DECISION_ADMIN:    { icon: "📋", color: "#a78bfa" },
  STATUT_MAJ:        { icon: "🔔", color: "#94a3b8" },
}

export default function NotificationsPage() {
  const { t, locale } = useI18n()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading]             = useState(true)

  useEffect(() => {
    fetch("/api/notifications").then((r) => r.json()).then((d) => setNotifications(d.notifications ?? [])).finally(() => setLoading(false))
  }, [])

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" })
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, lu: true } : n))
  }

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" })
    setNotifications((prev) => prev.map((n) => ({ ...n, lu: true })))
  }

  const unread = notifications.filter((n) => !n.lu).length

  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "32px 36px" }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "26px", fontWeight: 600, color: "#f8fafc", margin: "0 0 6px" }}>
            {t("student.notifications.title")}
          </h1>
          <p style={{ fontSize: "13px", color: "#475569" }}>
            {unread > 0 ? t("student.notifications.unread", { count: String(unread) }) : t("student.notifications.allRead")}
          </p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} style={{ padding: "9px 18px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
            {t("student.notifications.markAllRead")}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[1,2,3].map((i) => <div key={i} style={{ height: "80px", borderRadius: "14px", background: "rgba(10,20,42,0.4)", animation: "pulse 1.5s ease-in-out infinite" }}/>)}
        </div>
      ) : notifications.length === 0 ? (
        <div style={{ padding: "60px", borderRadius: "20px", textAlign: "center", background: "rgba(10,20,42,0.4)", border: "1px dashed rgba(255,255,255,0.08)" }}>
          <div style={{ color: "#334155", marginBottom: "20px" }}>
            <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"/>
            </svg>
          </div>
          <div style={{ fontSize: "16px", color: "#475569" }}>{t("student.notifications.empty")}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {notifications.map((n) => {
            const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.STATUT_MAJ
            return (
              <div key={n.id} onClick={() => !n.lu && markRead(n.id)} style={{ display: "flex", alignItems: "flex-start", gap: "14px", padding: "18px 20px", borderRadius: "14px", background: n.lu ? "rgba(10,20,42,0.4)" : "rgba(10,20,42,0.75)", border: n.lu ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(255,255,255,0.1)", cursor: n.lu ? "default" : "pointer", transition: "all 0.15s", position: "relative", opacity: n.lu ? 0.7 : 1 }}>
                {!n.lu && <div style={{ position: "absolute", top: "18px", right: "20px", width: "7px", height: "7px", borderRadius: "50%", background: "#f5c842" }}/>}
                <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: `${cfg.color}15`, border: `1px solid ${cfg.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", flexShrink: 0 }}>
                  {cfg.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "13.5px", color: n.lu ? "#64748b" : "#e2e8f0", margin: 0, lineHeight: 1.5, fontWeight: n.lu ? 400 : 500 }}>
                    {n.message}
                  </p>
                  <p style={{ fontSize: "11px", color: "#334155", marginTop: "5px" }}>
                    {new Date(n.dateEnvoi).toLocaleDateString(locale === "ar" ? "ar-TN" : locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100% { opacity:0.6; } 50% { opacity:0.3; } }`}</style>
    </div>
  )
}

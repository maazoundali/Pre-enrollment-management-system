"use client"

import { useEffect, useState } from "react"
import { useI18n } from "@/lib/i18n-context"

interface Annee {
  id:            string
  libelle:       string
  active:        boolean
  archivee:      boolean
  dateOuverture: string | null
  dateFermeture: string | null
  dateCreation:  string
  _count:        { dossiers: number }
}

export default function AdminAnneesPage() {
  const { t, locale } = useI18n()
  const [annees,  setAnnees]  = useState<Annee[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState("")
  const [success, setSuccess] = useState("")

  // ── Create form state ─────────────────────────────────────────────────────
  const [showForm,       setShowForm]       = useState(false)
  const [libelle,        setLibelle]        = useState("")
  const [dateOuverture,  setDateOuverture]  = useState("")
  const [dateFermeture,  setDateFermeture]  = useState("")
  const [saving,         setSaving]         = useState(false)
  const [archivingId,    setArchivingId]    = useState<string | null>(null)

  const fmtDate = (d: string | null) => d
    ? new Date(d).toLocaleDateString(locale === "ar" ? "ar-TN" : locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "—"

  async function load() {
    setLoading(true)
    try {
      const data = await fetch("/api/admin/annees").then(r => r.json())
      setAnnees(data.annees ?? [])
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!libelle.trim()) return
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/admin/annees", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libelle:      libelle.trim(),
          dateOuverture: dateOuverture || null,
          dateFermeture: dateFermeture || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setSuccess(t("admin.annees.createSuccess"))
      setLibelle(""); setDateOuverture(""); setDateFermeture(""); setShowForm(false)
      setTimeout(() => setSuccess(""), 4000)
      await load()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : t("common.error")) }
    finally { setSaving(false) }
  }

  async function handleArchive(id: string) {
    setArchivingId(id); setError("")
    try {
      const res = await fetch(`/api/admin/annees/${id}`, { method: "PATCH" })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setSuccess(t("admin.annees.archiveSuccess"))
      setTimeout(() => setSuccess(""), 4000)
      await load()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : t("common.error")) }
    finally { setArchivingId(null) }
  }

  const cardStyle: React.CSSProperties = { padding: "28px 32px", borderRadius: "20px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: "20px" }
  const inp: React.CSSProperties = { width: "100%", padding: "10px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f8fafc", fontSize: "13px", outline: "none", fontFamily: "inherit", boxSizing: "border-box", colorScheme: "dark" as never }
  const lbl: React.CSSProperties = { display: "block", fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as never, color: "#64748b", marginBottom: "7px" }

  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "32px 36px" }}>
      <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#f8fafc", margin: "0 0 6px" }}>
            {t("admin.annees.title")}
          </h1>
          <p style={{ fontSize: "13px", color: "#64748b" }}>{t("admin.annees.subtitle")}</p>
        </div>
        <button
          onClick={() => { setShowForm(f => !f); setError("") }}
          style={{ padding: "10px 20px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#f5c842,#e8a820)", color: "#060d1f", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
        >
          + {t("admin.annees.createBtn")}
        </button>
      </div>

      {error   && <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.28)", fontSize: "13px", color: "#fca5a5" }}>{error}</div>}
      {success && <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "12px", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", fontSize: "13px", color: "#4ade80" }}>{success}</div>}

      {/* Create form */}
      {showForm && (
        <div style={{ ...cardStyle, border: "1px solid rgba(245,200,66,0.25)" }}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "17px", fontWeight: 500, color: "#f8fafc", margin: "0 0 20px" }}>
            {t("admin.annees.createTitle")}
          </h2>
          <p style={{ fontSize: "12.5px", color: "#64748b", marginBottom: "20px" }}>
            {t("admin.annees.createWarning")}
          </p>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={lbl}>{t("admin.annees.libelle")} *</label>
              <input value={libelle} onChange={e => setLibelle(e.target.value)} placeholder="2026-2027" required style={inp} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={lbl}>{t("admin.annees.dateOuverture")}</label>
                <input type="date" value={dateOuverture} onChange={e => setDateOuverture(e.target.value)} style={inp} />
                <div style={{ fontSize: "11px", color: "#334155", marginTop: "4px" }}>{t("admin.annees.dateEmpty")}</div>
              </div>
              <div>
                <label style={lbl}>{t("admin.annees.dateFermeture")}</label>
                <input type="date" value={dateFermeture} onChange={e => setDateFermeture(e.target.value)} style={inp} />
                <div style={{ fontSize: "11px", color: "#334155", marginTop: "4px" }}>{t("admin.annees.dateEmpty")}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: "10px 20px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#94a3b8", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>
                {t("common.cancel")}
              </button>
              <button type="submit" disabled={saving || !libelle.trim()} style={{ padding: "10px 24px", borderRadius: "10px", border: "none", background: saving || !libelle.trim() ? "rgba(245,200,66,0.3)" : "linear-gradient(135deg,#f5c842,#e8a820)", color: "#060d1f", fontSize: "13px", fontWeight: 700, cursor: saving || !libelle.trim() ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {saving ? t("common.saving") : t("admin.annees.confirmCreate")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Years list */}
      {loading ? (
        <div style={{ color: "#334155", fontSize: "13px" }}>{t("common.loading")}</div>
      ) : annees.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: "center", color: "#334155" }}>
          <p style={{ fontSize: "15px", marginBottom: "8px" }}>Aucune année académique.</p>
          <p style={{ fontSize: "13px" }}>Créez la première année pour commencer.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {annees.map(annee => {
            const isActive   = annee.active
            const isArchived = annee.archivee
            const color  = isActive ? "#4ade80" : isArchived ? "#64748b" : "#f5c842"
            const bg     = isActive ? "rgba(74,222,128,0.08)" : isArchived ? "rgba(100,116,139,0.08)" : "rgba(245,200,66,0.08)"
            const border = isActive ? "1px solid rgba(74,222,128,0.2)" : isArchived ? "1px solid rgba(100,116,139,0.15)" : "1px solid rgba(245,200,66,0.2)"

            return (
              <div key={annee.id} style={{ padding: "20px 24px", borderRadius: "16px", background: bg, border, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "18px", fontWeight: 600, color: "#f8fafc" }}>{annee.libelle}</span>
                    <span style={{ padding: "2px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, background: bg, color, border }}>
                      {isActive ? t("admin.annees.statusActive") : isArchived ? t("admin.annees.statusArchived") : t("admin.annees.statusInactive")}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      📅 {fmtDate(annee.dateOuverture)} → {fmtDate(annee.dateFermeture)}
                    </span>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      📂 {annee._count.dossiers} {t("admin.annees.dossierCount")}
                    </span>
                  </div>
                </div>
                {!isArchived && (
                  <button
                    onClick={() => handleArchive(annee.id)}
                    disabled={!!archivingId}
                    style={{ padding: "8px 16px", borderRadius: "10px", border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.07)", color: "#f87171", fontSize: "12px", fontWeight: 600, cursor: archivingId ? "not-allowed" : "pointer", fontFamily: "inherit", flexShrink: 0 }}
                  >
                    {archivingId === annee.id ? "…" : t("admin.annees.archiveBtn")}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

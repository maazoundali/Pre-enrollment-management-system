"use client"

import { useEffect, useState } from "react"
import ConfirmModal from "@/components/ConfirmModal"
import { useI18n } from "@/lib/i18n-context"

interface Rapport {
  id:             string
  titre:          string
  periodeDebut:   string
  periodeFin:     string
  dateGeneration: string
  contenu: {
    totalEtudiants:  number
    totalDossiers:   number
    dossiersValides: number
    dossiersRejetes: number
    tauxValidation:  number
    scoreMoyen:      number
    parStatut:       Record<string, number>
    parFiliere:      { nom: string; dossiers: number; capacite: number }[]
  }
}

const STATUT_COLORS: Record<string, string> = {
  BROUILLON: "#94a3b8", SOUMIS: "#60a5fa",
  EN_ANALYSE: "#f5c842", VALIDE: "#4ade80", REJETE: "#f87171",
}

const inp: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: "10px",
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
  color: "#f8fafc", fontSize: "13px", outline: "none", fontFamily: "inherit",
  boxSizing: "border-box",
}
const lbl: React.CSSProperties = {
  display: "block", fontSize: "10.5px", fontWeight: 700,
  letterSpacing: "0.1em", textTransform: "uppercase",
  color: "#64748b", marginBottom: "8px",
}

function exportCSV(rapport: Rapport, labels: Record<string, string>) {
  const rows: string[][] = []
  rows.push(["Rapport", rapport.titre])
  rows.push(["Période", `${fmt(rapport.periodeDebut)} → ${fmt(rapport.periodeFin)}`])
  rows.push(["Généré le", fmt(rapport.dateGeneration)])
  rows.push([])
  rows.push(["Indicateur", "Valeur"])
  rows.push([labels.students,   String(rapport.contenu.totalEtudiants)])
  rows.push([labels.total,      String(rapport.contenu.totalDossiers)])
  rows.push([labels.valides,    String(rapport.contenu.dossiersValides)])
  rows.push([labels.rejetes,    String(rapport.contenu.dossiersRejetes)])
  rows.push([labels.rate,       `${rapport.contenu.tauxValidation}%`])
  rows.push([labels.score,      `${Math.round(rapport.contenu.scoreMoyen)}/100`])
  rows.push([])
  rows.push(["Statut", "Nombre"])
  for (const [key, count] of Object.entries(rapport.contenu.parStatut)) {
    rows.push([key, String(count)])
  }
  rows.push([])
  rows.push(["Filière", "Dossiers", "Capacité", "Taux"])
  for (const f of rapport.contenu.parFiliere) {
    rows.push([f.nom, String(f.dossiers), String(f.capacite), `${Math.round((f.dossiers / f.capacite) * 100)}%`])
  }
  const csv  = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n")
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url; a.download = `${rapport.titre.replace(/\s+/g, "_")}.csv`; a.click()
  URL.revokeObjectURL(url)
}

function exportJSON(rapport: Rapport) {
  const blob = new Blob([JSON.stringify(rapport.contenu, null, 2)], { type: "application/json" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url; a.download = `${rapport.titre.replace(/\s+/g, "_")}.json`; a.click()
  URL.revokeObjectURL(url)
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString()
}

export default function SupervisorRapportsPage() {
  const { t } = useI18n()
  const [rapports, setRapports]     = useState<Rapport[]>([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [deleteTarget, setDelete]   = useState<Rapport | null>(null)
  const [deleting, setDeleting]     = useState(false)
  const [error, setError]           = useState("")
  const [form, setForm] = useState({ titre: "", periodeDebut: "", periodeFin: "" })

  const STATUT_LABELS: Record<string, string> = {
    BROUILLON: t("statut.BROUILLON.label"), SOUMIS: t("statut.SOUMIS.label"),
    EN_ANALYSE: t("statut.EN_ANALYSE.label"), VALIDE: t("statut.VALIDE.label"), REJETE: t("statut.REJETE.label"),
  }

  useEffect(() => {
    fetch("/api/rapports").then((r) => r.json()).then((d) => setRapports(d.rapports ?? [])).finally(() => setLoading(false))
  }, [])

  async function handleGenerate() {
    if (!form.titre || !form.periodeDebut || !form.periodeFin) { setError(t("supervisor.rapports.form.required")); return }
    if (new Date(form.periodeFin) < new Date(form.periodeDebut)) { setError(t("supervisor.rapports.form.dateError")); return }
    setGenerating(true); setError("")
    try {
      const res = await fetch("/api/rapports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? t("common.error")) }
      const data = await res.json()
      setRapports((p) => [data.rapport, ...p])
      setShowForm(false); setExpanded(data.rapport.id); setForm({ titre: "", periodeDebut: "", periodeFin: "" })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"))
    } finally { setGenerating(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await fetch(`/api/rapports/${deleteTarget.id}`, { method: "DELETE" })
      setRapports((p) => p.filter((r) => r.id !== deleteTarget.id))
      if (expanded === deleteTarget.id) setExpanded(null)
    } finally { setDeleting(false); setDelete(null) }
  }

  const kpiLabels = {
    total:    t("supervisor.rapports.kpis.total"),
    valides:  t("supervisor.rapports.kpis.valides"),
    rejetes:  t("supervisor.rapports.kpis.rejetes"),
    rate:     t("supervisor.rapports.kpis.rate"),
    score:    t("supervisor.rapports.kpis.score"),
    students: t("supervisor.rapports.kpis.students"),
  }

  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "32px 36px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }`}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#f8fafc", margin: "0 0 6px" }}>{t("supervisor.rapports.title")}</h1>
          <p style={{ fontSize: "13px", color: "#64748b" }}>{t("supervisor.rapports.subtitle")}</p>
        </div>
        <button onClick={() => { setShowForm(true); setError("") }} style={{ padding: "11px 22px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#f5c842,#e8a820)", color: "#060d1f", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(232,184,32,0.3)" }}>
          {t("supervisor.rapports.newBtn")}
        </button>
      </div>

      {/* Generate modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "480px", padding: "36px 32px", borderRadius: "20px", background: "rgba(10,20,42,0.98)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 32px 80px rgba(0,0,0,0.7)", animation: "fadeIn 0.22s ease both" }}>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "20px", fontWeight: 500, color: "#f8fafc", margin: "0 0 24px" }}>{t("supervisor.rapports.form.title")}</h2>
            {error && <div style={{ marginBottom: "18px", padding: "10px 14px", borderRadius: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", fontSize: "13px", color: "#fca5a5" }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: "18px", marginBottom: "28px" }}>
              <div>
                <label style={lbl}>{t("supervisor.rapports.form.reportTitle")}</label>
                <input value={form.titre} onChange={(e) => setForm((p) => ({ ...p, titre: e.target.value }))} placeholder={t("supervisor.rapports.form.placeholder")} style={inp}/>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={lbl}>{t("supervisor.rapports.form.periodStart")}</label>
                  <input type="date" value={form.periodeDebut} onChange={(e) => setForm((p) => ({ ...p, periodeDebut: e.target.value }))} style={{ ...inp, colorScheme: "dark" }}/>
                </div>
                <div>
                  <label style={lbl}>{t("supervisor.rapports.form.periodEnd")}</label>
                  <input type="date" value={form.periodeFin} onChange={(e) => setForm((p) => ({ ...p, periodeFin: e.target.value }))} style={{ ...inp, colorScheme: "dark" }}/>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowForm(false)} style={{ padding: "11px 20px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#94a3b8", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>{t("common.cancel")}</button>
              <button onClick={handleGenerate} disabled={generating} style={{ padding: "11px 24px", borderRadius: "10px", border: "none", background: generating ? "rgba(245,200,66,0.4)" : "linear-gradient(135deg,#f5c842,#e8a820)", color: "#060d1f", fontSize: "13px", fontWeight: 700, cursor: generating ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "8px" }}>
                {generating && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.8s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="#060d1f" strokeWidth="3" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#060d1f" strokeWidth="3" strokeLinecap="round"/></svg>}
                {generating ? t("supervisor.rapports.form.generating") : t("supervisor.rapports.form.generate")}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title={t("supervisor.rapports.deleteModal.title")}
        message={t("supervisor.rapports.deleteModal.message", { name: deleteTarget?.titre ?? "" })}
        confirmLabel={t("supervisor.rapports.deleteModal.confirm")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDelete(null)}
      />

      {/* List */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {[1,2,3].map((i) => <div key={i} style={{ height: "76px", borderRadius: "16px", background: "rgba(10,20,42,0.4)", animation: "pulse 1.5s ease-in-out infinite" }}/>)}
        </div>
      ) : rapports.length === 0 ? (
        <div style={{ padding: "60px", borderRadius: "20px", background: "rgba(10,20,42,0.4)", border: "1px dashed rgba(255,255,255,0.1)", textAlign: "center" }}>
          <div style={{ color: "#334155", marginBottom: "20px" }}>
            <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>
            </svg>
          </div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "18px", color: "#64748b", marginBottom: "20px" }}>{t("supervisor.rapports.noRapports")}</div>
          <button onClick={() => setShowForm(true)} style={{ padding: "12px 24px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#f5c842,#e8a820)", color: "#060d1f", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {t("supervisor.rapports.firstBtn")}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {rapports.map((r) => {
            const isOpen = expanded === r.id
            return (
              <div key={r.id} style={{ borderRadius: "18px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", cursor: "pointer" }} onClick={() => setExpanded(isOpen ? null : r.id)}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "#f8fafc", marginBottom: "4px" }}>{r.titre}</div>
                    <div style={{ fontSize: "12px", color: "#475569" }}>
                      {fmt(r.periodeDebut)} → {fmt(r.periodeFin)}
                      <span style={{ margin: "0 8px", color: "#334155" }}>·</span>
                      {t("supervisor.rapports.generatedOn", { date: fmt(r.dateGeneration) })}
                      <span style={{ margin: "0 8px", color: "#334155" }}>·</span>
                      <span style={{ color: "#94a3b8" }}>{t("supervisor.rapports.dossiers", { count: String(r.contenu.totalDossiers) })}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, marginLeft: "16px" }}>
                    <button onClick={(e) => { e.stopPropagation(); exportCSV(r, kpiLabels) }} style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid rgba(74,222,128,0.25)", background: "rgba(74,222,128,0.07)", color: "#4ade80", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.04em" }}>
                      ↓ CSV
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); exportJSON(r) }} style={{ padding: "6px 12px", borderRadius: "8px", border: "1px solid rgba(167,139,250,0.25)", background: "rgba(167,139,250,0.07)", color: "#a78bfa", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.04em" }}>
                      ↓ JSON
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDelete(r) }} style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid rgba(248,113,113,0.2)", background: "rgba(248,113,113,0.07)", color: "#f87171", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>
                      🗑
                    </button>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#475569" strokeWidth={2} style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7"/>
                    </svg>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "22px 22px 24px", animation: "fadeIn 0.2s ease both" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "24px" }}>
                      {[
                        { label: kpiLabels.total,    value: r.contenu.totalDossiers,           color: "#94a3b8" },
                        { label: kpiLabels.valides,  value: r.contenu.dossiersValides,          color: "#4ade80" },
                        { label: kpiLabels.rejetes,  value: r.contenu.dossiersRejetes,          color: "#f87171" },
                        { label: kpiLabels.rate,     value: `${r.contenu.tauxValidation}%`,     color: "#4ade80" },
                        { label: kpiLabels.score,    value: `${Math.round(r.contenu.scoreMoyen)}/100`, color: "#f5c842" },
                        { label: kpiLabels.students, value: r.contenu.totalEtudiants,           color: "#60a5fa" },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ padding: "14px 16px", borderRadius: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <div style={{ fontSize: "22px", fontWeight: 700, color, lineHeight: 1, marginBottom: 5 }}>{value}</div>
                          <div style={{ fontSize: "11px", color: "#475569" }}>{label}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                      <div>
                        <div style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569", marginBottom: "14px" }}>{t("supervisor.rapports.byStatus")}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          {Object.entries(r.contenu.parStatut).map(([key, count]) => {
                            const pct = r.contenu.totalDossiers > 0 ? Math.round((count / r.contenu.totalDossiers) * 100) : 0
                            return (
                              <div key={key}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                                  <span style={{ fontSize: "12px", color: STATUT_COLORS[key] ?? "#94a3b8", fontWeight: 600 }}>{STATUT_LABELS[key] ?? key}</span>
                                  <span style={{ fontSize: "11px", color: "#475569" }}>{count} ({pct}%)</span>
                                </div>
                                <div style={{ height: "5px", borderRadius: "5px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                                  <div style={{ width: `${pct}%`, height: "100%", background: STATUT_COLORS[key] ?? "#94a3b8", borderRadius: "5px" }}/>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569", marginBottom: "14px" }}>{t("supervisor.rapports.byFiliere")}</div>
                        {r.contenu.parFiliere.length === 0 ? (
                          <p style={{ fontSize: "12px", color: "#334155" }}>{t("supervisor.rapports.noData")}</p>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {r.contenu.parFiliere.map((f) => {
                              const pct = f.capacite > 0 ? Math.round((f.dossiers / f.capacite) * 100) : 0
                              return (
                                <div key={f.nom}>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                                    <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 8 }}>{f.nom}</span>
                                    <span style={{ fontSize: "11px", color: "#475569", flexShrink: 0 }}>{f.dossiers}/{f.capacite}</span>
                                  </div>
                                  <div style={{ height: "5px", borderRadius: "5px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                                    <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: pct > 80 ? "#f87171" : pct > 50 ? "#f5c842" : "#4ade80", borderRadius: "5px" }}/>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100% { opacity:0.6 } 50% { opacity:0.3 } }`}</style>
    </div>
  )
}

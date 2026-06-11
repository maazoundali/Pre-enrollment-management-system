"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useI18n } from "@/lib/i18n-context"
import DonutChart from "@/components/charts/DonutChart"
import BarChart   from "@/components/charts/BarChart"

interface RecentDossier {
  id: string; statut: string; dateMaj: string
  etudiant: { nom: string | null; prenom: string | null; email: string }
  filiere:  { nom: string } | null
}

interface Stats {
  totalEtudiants: number
  totalDossiers:  number
  tauxValidation: number
  scoreMoyen:     number
  parStatut:      Record<string, number>
  filieres:       { id: string; nom: string; capacite: number; inscrits: number; tauxRemplissage: number; estComplete: boolean }[]
  recentDossiers: RecentDossier[]
}

interface Annee { id: string; libelle: string; active: boolean }

const STATUT_DOT: Record<string, string> = {
  SOUMIS:        "#60a5fa",
  EN_ANALYSE:    "#f5c842",
  VALIDE:        "#4ade80",
  REJETE:        "#f87171",
  LISTE_ATTENTE: "#a78bfa",
  BROUILLON:     "#475569",
}

function Initials({ name, color }: { name: string; color: string }) {
  const parts = name.trim().split(" ")
  const init  = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: "34px", height: "34px", borderRadius: "10px", flexShrink: 0,
      background: `${color}22`, border: `1px solid ${color}44`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "12px", fontWeight: 700, color, letterSpacing: "0.5px",
    }}>
      {init}
    </div>
  )
}

function relativeDate(dateStr: string, locale: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (locale === "ar") {
    if (mins < 60)  return `منذ ${mins} د`
    if (hours < 24) return `منذ ${hours} س`
    return `منذ ${days} ي`
  }
  if (locale === "en") {
    if (mins < 60)  return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }
  if (mins < 60)  return `il y a ${mins} min`
  if (hours < 24) return `il y a ${hours}h`
  return `il y a ${days}j`
}

export default function SupervisorDashboard() {
  const { t, locale } = useI18n()
  const [stats, setStats]     = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [annees, setAnnees]   = useState<Annee[]>([])
  const [anneeId, setAnneeId] = useState("")

  useEffect(() => {
    fetch("/api/annees").then(r => r.json()).then(d => {
      const list: Annee[] = d.annees ?? []
      setAnnees(list)
      const active = list.find(a => a.active)
      if (active) setAnneeId(active.id)
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    const url = anneeId ? `/api/admin/stats?anneeId=${anneeId}` : "/api/admin/stats"
    fetch(url).then(r => r.json()).then(setStats).finally(() => setLoading(false))
  }, [anneeId])

  const STATUT_CFG: Record<string, { label: string; color: string }> = {
    BROUILLON:     { label: t("statut.BROUILLON.label"),      color: "#475569" },
    SOUMIS:        { label: t("statut.SOUMIS.label"),          color: "#60a5fa" },
    EN_ANALYSE:    { label: t("statut.EN_ANALYSE.label"),      color: "#f5c842" },
    VALIDE:        { label: t("statut.VALIDE.label"),          color: "#4ade80" },
    REJETE:        { label: t("statut.REJETE.label"),          color: "#f87171" },
    LISTE_ATTENTE: { label: t("statut.LISTE_ATTENTE.label"),   color: "#a78bfa" },
  }

  const kpis = [
    {
      label: t("supervisor.dashboard.kpis.students"),
      value: stats?.totalEtudiants,
      color: "#60a5fa",
      icon: (
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/>
        </svg>
      ),
    },
    {
      label: t("supervisor.dashboard.kpis.total"),
      value: stats?.totalDossiers,
      color: "#94a3b8",
      icon: (
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776"/>
        </svg>
      ),
    },
    {
      label: t("supervisor.dashboard.kpis.rate"),
      value: stats ? `${stats.tauxValidation}%` : null,
      color: "#4ade80",
      icon: (
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
        </svg>
      ),
    },
    {
      label: t("supervisor.dashboard.kpis.score"),
      value: stats ? `${stats.scoreMoyen}/100` : null,
      color: "#f5c842",
      icon: (
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"/>
        </svg>
      ),
    },
  ]

  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "32px 36px" }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { 0%,100%{opacity:.5} 50%{opacity:1} }
        .kpi-card:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(0,0,0,0.4) !important; }
        .kpi-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px", flexWrap: "wrap", gap: "14px" }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "30px", fontWeight: 700, color: "#f8fafc", margin: "0 0 6px", letterSpacing: "-0.3px" }}>
            {t("supervisor.dashboard.title")}
          </h1>
          <p style={{ fontSize: "13px", color: "#475569", margin: 0 }}>
            {t("supervisor.dashboard.subtitle")}
          </p>
        </div>

        {annees.length > 1 && (
          <div style={{ display: "flex", gap: "4px", padding: "5px", borderRadius: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {annees.map(a => (
              <button key={a.id} onClick={() => setAnneeId(a.id)}
                style={{
                  padding: "7px 16px", borderRadius: "8px", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "12px",
                  background: anneeId === a.id ? "rgba(167,139,250,0.2)" : "transparent",
                  color: anneeId === a.id ? "#a78bfa" : "#475569",
                  fontWeight: anneeId === a.id ? 700 : 400,
                  boxShadow: anneeId === a.id ? "0 2px 8px rgba(167,139,250,0.2)" : "none",
                  transition: "all 0.15s",
                }}>
                {a.libelle}{a.active ? " ★" : ""}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "24px" }}>
        {kpis.map(({ label, value, color, icon }, idx) => (
          <div key={label} className="kpi-card" style={{
            padding: "22px 24px", borderRadius: "18px",
            background: "rgba(10,20,42,0.7)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderTop: `2px solid ${color}`,
            boxShadow: `0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.03)`,
            animation: `fadeUp 0.4s ease both`,
            animationDelay: `${idx * 60}ms`,
            position: "relative", overflow: "hidden",
          }}>
            {/* Subtle color wash */}
            <div style={{ position: "absolute", top: 0, right: 0, width: "80px", height: "80px", borderRadius: "50%", background: `${color}09`, transform: "translate(20px,-20px)", pointerEvents: "none" }}/>

            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{
                width: "38px", height: "38px", borderRadius: "11px",
                background: `${color}18`, border: `1px solid ${color}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color, boxShadow: `0 4px 16px ${color}20`,
              }}>
                {icon}
              </div>
            </div>

            <div style={{ fontSize: "32px", fontWeight: 800, color, lineHeight: 1, letterSpacing: "-0.5px" }}>
              {loading ? <div style={{ height: "32px", width: "60px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", animation: "shimmer 1.5s ease-in-out infinite" }}/> : (value ?? 0)}
            </div>
            <div style={{ fontSize: "12px", color: "#475569", marginTop: "7px", fontWeight: 500 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Performance & Targets analytics section */}
      {!loading && stats && (() => {
        const filieres  = stats.filieres ?? []
        const achieved  = filieres.filter(f => f.estComplete).length
        const onTrack   = filieres.filter(f => f.tauxRemplissage >= 60 && !f.estComplete).length
        const moderate  = filieres.filter(f => f.tauxRemplissage >= 30 && f.tauxRemplissage < 60).length
        const atRisk    = filieres.filter(f => f.tauxRemplissage < 30 && (f.capacite ?? 0) > 0).length
        const validated = stats.parStatut?.VALIDE        ?? 0
        const rejected  = stats.parStatut?.REJETE        ?? 0
        const submitted = stats.parStatut?.SOUMIS        ?? 0
        const inReview  = stats.parStatut?.EN_ANALYSE    ?? 0
        const waitlist  = stats.parStatut?.LISTE_ATTENTE ?? 0
        const pending   = submitted + inReview
        const processed = validated + rejected
        const acceptance = processed > 0 ? Math.round((validated / processed) * 100) : 0

        const loc = (fr: string, en: string, ar: string) =>
          locale === "en" ? en : locale === "ar" ? ar : fr

        const filStatus = (taux: number, estComplete: boolean) => {
          if (estComplete || taux >= 100)
            return { label: loc("Objectif atteint", "Goal reached", "تحقّق الهدف"),   color: "#4ade80", bg: "rgba(74,222,128,0.10)",  icon: "✓", rank: 0 }
          if (taux >= 60)
            return { label: loc("En bonne voie",    "On track",     "في المسار"),      color: "#60a5fa", bg: "rgba(96,165,250,0.10)",  icon: "↗", rank: 1 }
          if (taux >= 30)
            return { label: loc("Modéré",           "Moderate",     "متوسط"),          color: "#f5c842", bg: "rgba(245,200,66,0.10)",  icon: "→", rank: 2 }
          return   { label: loc("Critique",         "Critical",     "حرج"),            color: "#f87171", bg: "rgba(248,113,113,0.10)", icon: "!", rank: 3 }
        }

        const insightCards = [
          {
            label: loc("Objectifs atteints", "Targets hit",    "الأهداف المحققة"),
            value: `${achieved}/${filieres.length}`,
            sub:   achieved === filieres.length
              ? loc("Tous les objectifs remplis !", "All targets met!", "جميع الأهداف محققة!")
              : `${filieres.length - achieved} ${loc("filière(s) restante(s)", "program(s) remaining", "تخصص متبقٍّ")}`,
            color: achieved === filieres.length ? "#4ade80" : achieved > 0 ? "#f5c842" : "#f87171",
            icon: (
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0"/>
              </svg>
            ),
          },
          {
            label: loc("Taux d'acceptation", "Acceptance rate", "معدل القبول"),
            value: `${acceptance}%`,
            sub:   `${validated} ${loc("validés", "accepted", "مقبول")} · ${rejected} ${loc("rejetés", "rejected", "مرفوض")}`,
            color: acceptance >= 60 ? "#4ade80" : acceptance >= 40 ? "#f5c842" : "#f87171",
            icon: (
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
              </svg>
            ),
          },
          {
            label: loc("En traitement", "In pipeline", "قيد المعالجة"),
            value: String(pending),
            sub:   `${submitted} ${loc("soumis", "submitted", "مُقدَّم")} · ${inReview} ${loc("en analyse", "in review", "قيد الفحص")}`,
            color: pending > 20 ? "#f5c842" : "#60a5fa",
            icon: (
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
              </svg>
            ),
          },
          {
            label: loc("Liste d'attente", "Waitlist", "قائمة الانتظار"),
            value: String(waitlist),
            sub:   loc("candidats en attente de place", "candidates waiting for a spot", "مترشح ينتظر مقعداً"),
            color: waitlist > 0 ? "#a78bfa" : "#475569",
            icon: (
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/>
              </svg>
            ),
          },
        ]

        return (
          <div style={{ marginBottom: "20px", padding: "28px", borderRadius: "20px", background: "rgba(10,20,42,0.7)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 4px 32px rgba(0,0,0,0.3)" }}>
            {/* Section header */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "22px" }}>
              <div style={{ width: "4px", height: "18px", borderRadius: "99px", background: "linear-gradient(180deg,#f5c842,#4ade80)" }}/>
              <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "16px", fontWeight: 600, color: "#f1f5f9", margin: 0 }}>
                {loc("Performance & Objectifs", "Performance & Targets", "الأداء والأهداف")}
              </h2>
            </div>

            {/* 4 insight metric cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px", marginBottom: "22px" }}>
              {insightCards.map(card => (
                <div key={card.label} style={{
                  padding: "16px 18px", borderRadius: "16px",
                  background: `${card.color}09`,
                  border: `1px solid ${card.color}28`,
                  boxShadow: `0 4px 16px ${card.color}0a`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <div style={{ color: card.color, opacity: 0.85 }}>{card.icon}</div>
                    <div style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569" }}>{card.label}</div>
                  </div>
                  <div style={{ fontSize: "26px", fontWeight: 800, color: card.color, lineHeight: 1, letterSpacing: "-0.5px", marginBottom: "6px" }}>{card.value}</div>
                  <div style={{ fontSize: "11px", color: "#475569" }}>{card.sub}</div>
                </div>
              ))}
            </div>

            {/* Filière target status — clean list */}
            {filieres.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#334155", marginBottom: "2px" }}>
                  {loc("Statut par filière", "Status by program", "الحالة حسب التخصص")}
                </div>
                {[...filieres]
                  .sort((a, b) => filStatus(a.tauxRemplissage, a.estComplete).rank - filStatus(b.tauxRemplissage, b.estComplete).rank)
                  .map(f => {
                    const st  = filStatus(f.tauxRemplissage, f.estComplete)
                    const pct = Math.min(f.tauxRemplissage, 100)
                    return (
                      <div key={f.id} style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: st.color, flexShrink: 0, boxShadow: `0 0 6px ${st.color}` }}/>
                        <div style={{ fontSize: "12.5px", color: "#94a3b8", fontWeight: 500, minWidth: "160px", flex: "0 0 160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nom}</div>
                        <div style={{ flex: 1, height: "4px", borderRadius: "99px", background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", borderRadius: "99px", background: st.color, opacity: 0.7, transition: "width 1s cubic-bezier(0.4,0,0.2,1)" }}/>
                        </div>
                        <span style={{ fontSize: "11px", color: st.color, fontWeight: 600, minWidth: "34px", textAlign: "right" }}>{pct}%</span>
                        <span style={{ fontSize: "10.5px", color: st.color, background: st.bg, padding: "2px 9px", borderRadius: "20px", fontWeight: 600, flexShrink: 0, minWidth: "110px", textAlign: "center" }}>
                          {st.label}
                        </span>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        )
      })()}

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>

        {/* Status donut */}
        <div style={{
          padding: "28px", borderRadius: "20px",
          background: "rgba(10,20,42,0.7)", border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 4px 32px rgba(0,0,0,0.3)",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px", flexShrink: 0 }}>
            <div style={{ width: "4px", height: "18px", borderRadius: "99px", background: "linear-gradient(180deg,#a78bfa,#60a5fa)" }}/>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "16px", fontWeight: 600, color: "#f1f5f9", margin: 0 }}>
              {t("supervisor.dashboard.byStatus")}
            </h2>
          </div>
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {loading
              ? <div style={{ color: "#334155", fontSize: "13px" }}>{t("common.loading")}</div>
              : (
                <DonutChart
                  size={200}
                  title={t("supervisor.dashboard.kpis.total")}
                  data={Object.entries(STATUT_CFG).map(([key, cfg]) => ({
                    label: cfg.label,
                    value: stats?.parStatut?.[key] ?? 0,
                    color: cfg.color,
                  }))}
                />
              )
            }
          </div>
        </div>

        {/* Capacity bars */}
        {(() => {
          const filieres      = stats?.filieres ?? []
          const totalCap      = filieres.reduce((s, f) => s + (f.capacite ?? 0), 0)
          const totalIns      = filieres.reduce((s, f) => s + f.inscrits, 0)
          const overallPct    = totalCap > 0 ? Math.min(Math.round((totalIns / totalCap) * 100), 100) : 0
          const overallColor  = overallPct > 80 ? "#f87171" : overallPct > 60 ? "#f5c842" : "#4ade80"
          return (
            <div style={{
              padding: "28px", borderRadius: "20px",
              background: "rgba(10,20,42,0.7)", border: "1px solid rgba(255,255,255,0.07)",
              boxShadow: "0 4px 32px rgba(0,0,0,0.3)",
              display: "flex", flexDirection: "column", gap: "22px",
            }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "4px", height: "18px", borderRadius: "99px", background: "linear-gradient(180deg,#4ade80,#f5c842)" }}/>
                <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "16px", fontWeight: 600, color: "#f1f5f9", margin: 0 }}>
                  {t("supervisor.dashboard.capacity")}
                </h2>
              </div>

              {loading
                ? <div style={{ color: "#334155", fontSize: "13px" }}>{t("common.loading")}</div>
                : filieres.length === 0
                  ? <p style={{ color: "#334155", fontSize: "13px", margin: 0 }}>{t("supervisor.dashboard.noFilieres")}</p>
                  : <>
                    {/* Overall summary banner */}
                    {totalCap > 0 && (
                      <div style={{
                        padding: "18px 20px", borderRadius: "16px",
                        background: `linear-gradient(135deg, ${overallColor}0d, ${overallColor}06)`,
                        border: `1px solid ${overallColor}28`,
                        boxShadow: `0 0 24px ${overallColor}10`,
                      }}>
                        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "12px" }}>
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569", marginBottom: "6px" }}>
                              {t("supervisor.dashboard.capacity")}
                            </div>
                            <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                              <span style={{ fontSize: "34px", fontWeight: 800, color: overallColor, lineHeight: 1, letterSpacing: "-1px" }}>{totalIns}</span>
                              <span style={{ fontSize: "16px", color: "#334155", fontWeight: 500 }}>/ {totalCap}</span>
                            </div>
                            <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px" }}>
                              {totalCap - totalIns} {locale === "ar" ? "مقعد متبقٍّ" : locale === "en" ? "seats remaining" : "places restantes"}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "42px", fontWeight: 900, color: overallColor, lineHeight: 1, letterSpacing: "-2px" }}>{overallPct}%</div>
                            <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px" }}>
                              {overallPct > 80
                                ? (locale === "ar" ? "شبه ممتلئ" : locale === "en" ? "Nearly full" : "Presque plein")
                                : overallPct > 60
                                  ? (locale === "ar" ? "يمتلئ بسرعة" : locale === "en" ? "Filling up" : "Se remplit")
                                  : (locale === "ar" ? "مقاعد متاحة" : locale === "en" ? "Seats available" : "Places disponibles")}
                            </div>
                          </div>
                        </div>
                        {/* Overall progress bar */}
                        <div style={{ height: "10px", borderRadius: "99px", background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                          <div style={{
                            width: `${overallPct}%`, height: "100%", borderRadius: "99px",
                            background: overallPct > 80
                              ? "linear-gradient(90deg,#ef4444,#f87171)"
                              : overallPct > 60
                                ? "linear-gradient(90deg,#e8a820,#f5c842)"
                                : "linear-gradient(90deg,#22c55e,#4ade80)",
                            boxShadow: `0 0 14px ${overallColor}66`,
                            transition: "width 1.2s cubic-bezier(0.4,0,0.2,1)",
                          }}/>
                        </div>
                      </div>
                    )}

                    {/* Per-filière bars */}
                    <BarChart
                      data={filieres.map(f => ({
                        label: f.nom,
                        value: f.inscrits,
                        max:   f.capacite,
                        color: "#4ade80",
                        sub:   f.capacite ? `/ ${f.capacite}` : "",
                      }))}
                    />
                  </>
              }
            </div>
          )
        })()}
      </div>

      {/* Recent activity */}
      {(stats?.recentDossiers ?? []).length > 0 && (
        <div style={{
          padding: "28px", borderRadius: "20px",
          background: "rgba(10,20,42,0.7)", border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 4px 32px rgba(0,0,0,0.3)",
          marginBottom: "20px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <div style={{ width: "4px", height: "18px", borderRadius: "99px", background: "linear-gradient(180deg,#f5c842,#f87171)" }}/>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "16px", fontWeight: 600, color: "#f1f5f9", margin: 0 }}>
              {t("supervisor.dashboard.recentActivity")}
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {(stats?.recentDossiers ?? []).map((d, idx) => {
              const name = [d.etudiant.prenom, d.etudiant.nom].filter(Boolean).join(" ") || d.etudiant.email
              const dot  = STATUT_DOT[d.statut] ?? "#475569"
              const cfg  = STATUT_CFG[d.statut]
              return (
                <Link key={d.id} href={`/supervisor/dossiers/${d.id}`}
                  style={{
                    display: "flex", alignItems: "center", gap: "14px",
                    padding: "12px 14px", borderRadius: "14px", textDecoration: "none",
                    background: "transparent", border: "1px solid transparent",
                    transition: "all 0.15s ease",
                    animation: `fadeUp 0.3s ease both`,
                    animationDelay: `${idx * 50}ms`,
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.background = "rgba(255,255,255,0.03)"
                    el.style.border     = "1px solid rgba(255,255,255,0.07)"
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.background = "transparent"
                    el.style.border     = "1px solid transparent"
                  }}
                >
                  <Initials name={name} color={dot}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "#f1f5f9", marginBottom: "2px" }}>{name}</div>
                    <div style={{ fontSize: "11.5px", color: "#475569" }}>{d.filiere?.nom ?? "—"}</div>
                  </div>
                  <span style={{
                    fontSize: "11px", padding: "3px 10px", borderRadius: "20px",
                    background: `${dot}18`, color: dot, fontWeight: 700, flexShrink: 0,
                    boxShadow: `0 0 8px ${dot}22`,
                  }}>
                    {cfg?.label ?? d.statut}
                  </span>
                  <span style={{ fontSize: "11px", color: "#334155", flexShrink: 0, minWidth: "70px", textAlign: "right" }}>
                    {relativeDate(d.dateMaj, locale)}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* CTA */}
      <div style={{
        padding: "28px 32px", borderRadius: "20px",
        background: "linear-gradient(135deg, rgba(76,29,149,0.35), rgba(30,58,138,0.35))",
        border: "1px solid rgba(167,139,250,0.2)",
        boxShadow: "0 4px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px",
      }}>
        <div>
          <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "18px", fontWeight: 600, color: "#f1f5f9", marginBottom: "6px" }}>
            {t("supervisor.dashboard.generateReport")}
          </div>
          <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
            {t("supervisor.dashboard.generateReportDesc")}
          </p>
        </div>
        <Link href="/supervisor/rapports"
          style={{
            padding: "12px 26px", borderRadius: "13px", border: "none", flexShrink: 0,
            background: "linear-gradient(135deg, #f5c842, #e8a820)",
            color: "#060d1f", fontSize: "13px", fontWeight: 700, textDecoration: "none",
            boxShadow: "0 4px 20px rgba(232,168,32,0.35), 0 1px 0 rgba(255,255,255,0.2) inset",
            letterSpacing: "0.2px",
          }}>
          {t("supervisor.dashboard.goToReports")}
        </Link>
      </div>
    </div>
  )
}

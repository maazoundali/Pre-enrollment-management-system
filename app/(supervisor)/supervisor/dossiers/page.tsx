"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useI18n } from "@/lib/i18n-context"

interface Dossier {
  id: string; statut: string; score: number | null; dateCreation: string
  etudiant: { nom: string | null; prenom: string | null; email: string }
  filiere:  { id: string; nom: string } | null
  diplomes: { type: string | null; sousType: string | null }[]
  _count?:  { documents: number }
}

const STATUTS = ["TOUS", "BROUILLON", "SOUMIS", "EN_ANALYSE", "VALIDE", "REJETE", "LISTE_ATTENTE"]
const BAC_SERIES = ["SCIENTIFIQUE", "MATHS_INFO", "TECHNIQUE", "ECONOMIE", "LETTRES", "SPORT"]

export default function SupervisorDossiersPage() {
  const { t } = useI18n()
  const [dossiers, setDossiers]   = useState<Dossier[]>([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState("TOUS")
  const [search, setSearch]       = useState("")
  const [filieres, setFilieres]   = useState<{ id: string; nom: string }[]>([])
  const [annees, setAnnees]       = useState<{ id: string; libelle: string; active: boolean }[]>([])
  const [anneeId, setAnneeId]     = useState("")
  const [filiereFilter, setFiliereFilter] = useState("")
  const [bacFilter, setBacFilter]         = useState("")
  const [scoreMin, setScoreMin]           = useState("")
  const [scoreMax, setScoreMax]           = useState("")
  const [filtersOpen, setFiltersOpen]     = useState(false)

  const STATUT_CFG: Record<string, { label: string; color: string; bg: string }> = {
    BROUILLON:     { label: t("statut.BROUILLON.label"),     color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
    SOUMIS:        { label: t("statut.SOUMIS.label"),         color: "#60a5fa", bg: "rgba(96,165,250,0.12)"  },
    EN_ANALYSE:    { label: t("statut.EN_ANALYSE.label"),     color: "#f5c842", bg: "rgba(245,200,66,0.12)"  },
    VALIDE:        { label: t("statut.VALIDE.label"),         color: "#4ade80", bg: "rgba(74,222,128,0.12)"  },
    REJETE:        { label: t("statut.REJETE.label"),         color: "#f87171", bg: "rgba(248,113,113,0.12)" },
    LISTE_ATTENTE: { label: t("statut.LISTE_ATTENTE.label"),  color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  }

  useEffect(() => {
    fetch("/api/filieres").then(r => r.json()).then(d => setFilieres(d.filieres ?? []))
    fetch("/api/annees").then(r => r.json()).then(d => {
      const list = d.annees ?? []
      setAnnees(list)
      const active = list.find((a: { active: boolean }) => a.active)
      if (active) setAnneeId(active.id)
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ limit: "200" })
    if (filter !== "TOUS") params.set("statut", filter)
    if (anneeId) params.set("anneeId", anneeId)
    fetch(`/api/dossiers?${params}`).then(r => r.json()).then(d => setDossiers(d.dossiers ?? [])).finally(() => setLoading(false))
  }, [filter, anneeId])

  const filtered = dossiers.filter(d => {
    if (search) {
      const q = search.toLowerCase()
      const name = [d.etudiant.prenom, d.etudiant.nom].join(" ").toLowerCase()
      if (!name.includes(q) && !d.etudiant.email.toLowerCase().includes(q) && !(d.filiere?.nom ?? "").toLowerCase().includes(q)) return false
    }
    if (filiereFilter && d.filiere?.id !== filiereFilter) return false
    if (bacFilter) {
      const bac = d.diplomes.find(x => x.type === "BAC")
      if (!bac || bac.sousType !== bacFilter) return false
    }
    if (scoreMin !== "" && (d.score === null || d.score < parseFloat(scoreMin))) return false
    if (scoreMax !== "" && (d.score === null || d.score > parseFloat(scoreMax))) return false
    return true
  })

  const hasFilters = !!(filiereFilter || bacFilter || scoreMin || scoreMax)

  const selStyle: React.CSSProperties = { padding:"7px 10px", borderRadius:"8px", background:"#0d1b35", border:"1px solid rgba(255,255,255,0.12)", color:"#f8fafc", fontSize:"12px", outline:"none", fontFamily:"inherit", cursor:"pointer", colorScheme:"dark" as never }
  const lblStyle: React.CSSProperties = { display:"block", fontSize:"9.5px", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase" as never, color:"#475569", marginBottom:"5px" }

  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "32px 36px" }}>
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#f8fafc", margin: "0 0 6px" }}>
          {t("supervisor.dossiers.title")}
        </h1>
        <p style={{ fontSize: "13px", color: "#64748b" }}>
          {loading ? t("common.loading") : t("supervisor.dossiers.found", { count: String(filtered.length) })}
        </p>
      </div>

      {/* Year selector */}
      {annees.length > 1 && (
        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"16px", padding:"10px 14px", borderRadius:"12px", background:"rgba(10,20,42,0.5)", border:"1px solid rgba(255,255,255,0.07)" }}>
          <span style={{ fontSize:"11.5px", color:"#475569", fontWeight:600, flexShrink:0 }}>{t("supervisor.dossiers.yearFilter")} :</span>
          <div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
            {annees.map(a => (
              <button key={a.id} onClick={() => setAnneeId(a.id)} style={{ padding:"4px 12px", borderRadius:"8px", border:"none", background: anneeId === a.id ? "rgba(167,139,250,0.15)" : "transparent", color: anneeId === a.id ? "#a78bfa" : "#475569", fontSize:"12px", fontWeight: anneeId === a.id ? 700 : 400, cursor:"pointer", fontFamily:"inherit" }}>
                {a.libelle}{a.active ? " ★" : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Status tabs + search + filters */}
      <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: filtersOpen ? "10px" : "20px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "3px", background: "rgba(10,20,42,0.6)", borderRadius: "12px", padding: "4px", border: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap" }}>
          {STATUTS.map(s => {
            const cfg = s === "TOUS" ? null : STATUT_CFG[s]
            return (
              <button key={s} onClick={() => setFilter(s)} style={{ padding:"6px 12px", borderRadius:"9px", border:"none", background: filter === s ? (cfg ? cfg.bg : "rgba(255,255,255,0.08)") : "transparent", color: filter === s ? (cfg ? cfg.color : "#f8fafc") : "#475569", fontSize:"11.5px", fontWeight: filter===s ? 700 : 400, cursor:"pointer", fontFamily:"inherit" }}>
                {s === "TOUS" ? t("admin.dossiersList.all") : (cfg?.label ?? s)}
              </button>
            )
          })}
        </div>
        <input type="text" placeholder={t("admin.dossiersList.search")} value={search} onChange={e => setSearch(e.target.value)} style={{ flex:1, minWidth:"200px", padding:"8px 14px", borderRadius:"10px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#f8fafc", fontSize:"13px", outline:"none", fontFamily:"inherit" }}/>
        <button onClick={() => setFiltersOpen(o => !o)} style={{ display:"flex", alignItems:"center", gap:"5px", padding:"8px 12px", borderRadius:"9px", background: hasFilters ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.04)", border: hasFilters ? "1px solid rgba(167,139,250,0.3)" : "1px solid rgba(255,255,255,0.08)", color: hasFilters ? "#a78bfa" : "#64748b", fontSize:"12px", fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z"/></svg>
          {t("admin.dossiersList.advancedFilters.btn")}{hasFilters ? ` (${[filiereFilter,bacFilter,scoreMin,scoreMax].filter(Boolean).length})` : ""}
        </button>
      </div>

      {filtersOpen && (
        <div style={{ padding:"14px 18px", borderRadius:"12px", background:"rgba(10,20,42,0.7)", border:"1px solid rgba(167,139,250,0.2)", marginBottom:"18px", display:"flex", gap:"14px", flexWrap:"wrap", alignItems:"flex-end" }}>
          <div style={{ minWidth:"180px" }}>
            <label style={lblStyle}>{t("admin.dossiersList.advancedFilters.filiere")}</label>
            <select value={filiereFilter} onChange={e => setFiliereFilter(e.target.value)} style={selStyle}>
              <option value="">{t("admin.dossiersList.advancedFilters.allFilieres")}</option>
              {filieres.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
          </div>
          <div style={{ minWidth:"150px" }}>
            <label style={lblStyle}>{t("admin.dossiersList.advancedFilters.bacSerie")}</label>
            <select value={bacFilter} onChange={e => setBacFilter(e.target.value)} style={selStyle}>
              <option value="">{t("admin.dossiersList.advancedFilters.allSeries")}</option>
              {BAC_SERIES.map(s => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ")}</option>)}
            </select>
          </div>
          <div>
            <label style={lblStyle}>{t("admin.dossiersList.advancedFilters.scoreRange")}</label>
            <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
              <input type="number" min="0" max="100" placeholder="Min" value={scoreMin} onChange={e => setScoreMin(e.target.value)} style={{ width:"60px", padding:"6px 8px", borderRadius:"8px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#f8fafc", fontSize:"12px", outline:"none", fontFamily:"inherit", textAlign:"center" }}/>
              <span style={{ color:"#334155", fontSize:"11px" }}>–</span>
              <input type="number" min="0" max="100" placeholder="Max" value={scoreMax} onChange={e => setScoreMax(e.target.value)} style={{ width:"60px", padding:"6px 8px", borderRadius:"8px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#f8fafc", fontSize:"12px", outline:"none", fontFamily:"inherit", textAlign:"center" }}/>
            </div>
          </div>
          {hasFilters && <button onClick={() => { setFiliereFilter(""); setBacFilter(""); setScoreMin(""); setScoreMax("") }} style={{ padding:"6px 12px", borderRadius:"8px", border:"1px solid rgba(248,113,113,0.25)", background:"rgba(248,113,113,0.07)", color:"#f87171", fontSize:"12px", cursor:"pointer", fontFamily:"inherit" }}>{t("admin.dossiersList.advancedFilters.clear")}</button>}
        </div>
      )}

      {/* Table */}
      <div style={{ borderRadius:"16px", background:"rgba(10,20,42,0.65)", border:"1px solid rgba(255,255,255,0.07)", overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 2fr 80px 80px 100px", padding:"10px 20px", background:"rgba(255,255,255,0.03)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          {[t("admin.dossiersList.headers.student"), t("admin.dossiersList.headers.filiere"), t("admin.dossiersList.headers.documents"), t("admin.dossiersList.headers.score"), t("admin.dossiersList.headers.status")].map(h => (
            <div key={h} style={{ fontSize:"10px", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#475569" }}>{h}</div>
          ))}
        </div>
        {loading ? (
          [1,2,3].map(i => <div key={i} style={{ height:"56px", borderBottom:"1px solid rgba(255,255,255,0.04)", animation:"pulse 1.5s ease-in-out infinite" }}/>)
        ) : filtered.length === 0 ? (
          <div style={{ padding:"48px", textAlign:"center", color:"#334155", fontSize:"13px" }}>{t("admin.dossiersList.noResult")}</div>
        ) : filtered.map((d, idx) => {
          const cfg  = STATUT_CFG[d.statut] ?? STATUT_CFG.SOUMIS
          const name = [d.etudiant.prenom, d.etudiant.nom].filter(Boolean).join(" ") || d.etudiant.email
          return (
            <Link key={d.id} href={`/supervisor/dossiers/${d.id}`} style={{ display:"grid", gridTemplateColumns:"2fr 2fr 80px 80px 100px", padding:"13px 20px", alignItems:"center", borderBottom: idx < filtered.length-1 ? "1px solid rgba(255,255,255,0.04)" : "none", textDecoration:"none", background:"transparent", transition:"background 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(245,200,66,0.03)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div>
                <div style={{ fontSize:"13px", fontWeight:600, color:"#f8fafc" }}>{name}</div>
                <div style={{ fontSize:"11px", color:"#475569", marginTop:"1px" }}>{d.etudiant.email}</div>
              </div>
              <div style={{ fontSize:"13px", color:"#94a3b8" }}>{d.filiere?.nom ?? "—"}</div>
              <div style={{ fontSize:"13px", color:"#64748b" }}>{d._count?.documents ?? 0}</div>
              <div style={{ fontSize:"13px", color: d.score !== null ? "#f5c842" : "#334155" }}>{d.score !== null ? `${Math.round(d.score)}/100` : "—"}</div>
              <div><span style={{ padding:"3px 10px", borderRadius:"20px", background:cfg.bg, color:cfg.color, fontSize:"11px", fontWeight:600 }}>{cfg.label}</span></div>
            </Link>
          )
        })}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:.3} }`}</style>
    </div>
  )
}

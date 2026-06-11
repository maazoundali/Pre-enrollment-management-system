"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useI18n } from "@/lib/i18n-context"

interface Dossier {
  id: string; statut: string; score: number | null; dateCreation: string; dateMaj: string
  etudiant: { nom: string | null; prenom: string | null; email: string; cin: string | null }
  filiere:  { id: string; nom: string } | null
  annee:    { id: string; libelle: string }
  diplomes: { type: string | null; sousType: string | null }[]
  _count?:  { documents: number }
}
interface Annee { id: string; libelle: string; active: boolean; archivee: boolean }

const STATUTS = ["TOUS", "BROUILLON", "SOUMIS", "EN_ANALYSE", "VALIDE", "REJETE", "LISTE_ATTENTE"]

// Batch transitions allowed from each source status
const BATCH_ACTIONS: Record<string, { label: string; statut: string; color: string; bg: string }[]> = {
  SOUMIS:        [{ label: "→ En analyse", statut: "EN_ANALYSE", color: "#f5c842", bg: "rgba(245,200,66,0.15)" }],
  EN_ANALYSE:    [{ label: "→ Valider",    statut: "VALIDE",     color: "#4ade80", bg: "rgba(74,222,128,0.15)" },
                  { label: "→ Rejeter",    statut: "REJETE",     color: "#f87171", bg: "rgba(248,113,113,0.12)" }],
  LISTE_ATTENTE: [{ label: "→ En analyse", statut: "EN_ANALYSE", color: "#f5c842", bg: "rgba(245,200,66,0.15)" }],
}

const BAC_SERIES = ["SCIENTIFIQUE", "MATHS_INFO", "TECHNIQUE", "ECONOMIE", "LETTRES", "SPORT"]

export default function AdminDossiersPage() {
  const { t } = useI18n()
  const [dossiers, setDossiers]     = useState<Dossier[]>([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState("TOUS")
  const [search, setSearch]         = useState("")
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [batchLoading, setBatch]    = useState(false)
  const [batchResult, setBatchResult] = useState<string | null>(null)

  // Year selector — defaults to active year, falls back to most recent
  const [annees,      setAnnees]      = useState<Annee[]>([])
  const [anneeFilter, setAnneeFilter] = useState<string>("__loading__")

  useEffect(() => {
    fetch("/api/admin/annees").then(r => r.json()).then(d => {
      const list: Annee[] = d.annees ?? []
      setAnnees(list)
      const active = list.find(a => a.active)
      setAnneeFilter(active?.id ?? list[0]?.id ?? "")
    })
  }, [])

  // Advanced filters
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filieres, setFilieres]       = useState<{ id: string; nom: string }[]>([])
  const [filiereFilter, setFiliereFilter] = useState("")
  const [bacFilter, setBacFilter]         = useState("")
  const [scoreMin, setScoreMin]           = useState("")
  const [scoreMax, setScoreMax]           = useState("")
  const [dateFrom, setDateFrom]           = useState("")
  const [dateTo, setDateTo]               = useState("")

  useEffect(() => {
    fetch("/api/filieres").then(r => r.json()).then(d => setFilieres(d.filieres ?? []))
  }, [])

  const hasAdvancedFilters = !!(filiereFilter || bacFilter || scoreMin || scoreMax || dateFrom || dateTo)

  function clearAdvanced() {
    setFiliereFilter(""); setBacFilter(""); setScoreMin(""); setScoreMax(""); setDateFrom(""); setDateTo("")
  }

  const STATUT_CFG: Record<string, { label: string; color: string; bg: string }> = {
    BROUILLON:     { label: t("statut.BROUILLON.label"),     color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
    SOUMIS:        { label: t("statut.SOUMIS.label"),         color: "#60a5fa", bg: "rgba(96,165,250,0.12)"  },
    EN_ANALYSE:    { label: t("statut.EN_ANALYSE.label"),     color: "#f5c842", bg: "rgba(245,200,66,0.12)"  },
    VALIDE:        { label: t("statut.VALIDE.label"),         color: "#4ade80", bg: "rgba(74,222,128,0.12)"  },
    REJETE:        { label: t("statut.REJETE.label"),         color: "#f87171", bg: "rgba(248,113,113,0.12)" },
    LISTE_ATTENTE: { label: t("statut.LISTE_ATTENTE.label"),  color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  }

  useEffect(() => {
    if (anneeFilter === "__loading__") return   // wait until years are fetched
    async function load() {
      setLoading(true); setSelected(new Set())
      try {
        const params = new URLSearchParams({ limit: "200" })
        if (filter !== "TOUS") params.set("statut", filter)
        if (anneeFilter)       params.set("anneeId", anneeFilter)
        const data = await fetch(`/api/dossiers?${params}`).then((r) => r.json())
        setDossiers(data.dossiers ?? [])
      } finally { setLoading(false) }
    }
    load()
  }, [filter, anneeFilter])

  const filtered = dossiers.filter((d) => {
    // Text search
    if (search) {
      const q    = search.toLowerCase()
      const name = [d.etudiant.prenom, d.etudiant.nom].join(" ").toLowerCase()
      if (!name.includes(q) && !d.etudiant.email.toLowerCase().includes(q) &&
          !(d.etudiant.cin ?? "").includes(q) && !(d.filiere?.nom ?? "").toLowerCase().includes(q)) {
        return false
      }
    }
    // Filière filter
    if (filiereFilter && d.filiere?.id !== filiereFilter) return false
    // BAC series filter
    if (bacFilter) {
      const bacDiplome = d.diplomes.find(x => x.type === "BAC")
      if (!bacDiplome || bacDiplome.sousType !== bacFilter) return false
    }
    // Score range
    if (scoreMin !== "" && (d.score === null || d.score < parseFloat(scoreMin))) return false
    if (scoreMax !== "" && (d.score === null || d.score > parseFloat(scoreMax))) return false
    // Date range
    if (dateFrom && new Date(d.dateCreation) < new Date(dateFrom)) return false
    if (dateTo   && new Date(d.dateCreation) > new Date(dateTo + "T23:59:59")) return false
    return true
  })

  function toggleAll() {
    if (selected.size === filtered.length) { setSelected(new Set()) }
    else { setSelected(new Set(filtered.map((d) => d.id))) }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function exportCSV() {
    const BOM = "﻿"
    const headers = ["Référence", "Nom", "Prénom", "Email", "Statut", "Filière", "Score /100", "Date création", "Dernière maj"]
    const rows = filtered.map((d) => [
      `DOSS-${d.id.slice(0, 8).toUpperCase()}`,
      d.etudiant.nom   ?? "",
      d.etudiant.prenom ?? "",
      d.etudiant.email,
      STATUT_CFG[d.statut]?.label ?? d.statut,
      d.filiere?.nom ?? "",
      d.score != null ? String(d.score) : "",
      new Date(d.dateCreation).toLocaleDateString("fr-FR"),
      new Date(d.dateMaj).toLocaleDateString("fr-FR"),
    ])
    const csv = BOM + [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href     = url
    a.download = `dossiers-${filter.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Determine which batch actions are available for the current selection
  const selectedDossiers = filtered.filter((d) => selected.has(d.id))
  const uniqueStatuts    = [...new Set(selectedDossiers.map((d) => d.statut))]
  const availableBatch   = uniqueStatuts.length === 1 ? (BATCH_ACTIONS[uniqueStatuts[0]] ?? []) : []

  async function runBatch(statut: string) {
    setBatch(true); setBatchResult(null)
    const res = await fetch("/api/dossiers/batch", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected], statut }),
    })
    const data = await res.json()
    setBatchResult(`✓ ${data.updated} ${t("admin.batch.updated")}${data.skipped ? ` · ${data.skipped} ${t("admin.batch.skipped")}` : ""}`)
    setSelected(new Set())
    // Reload
    const reloadParams = new URLSearchParams({ limit: "200" })
    if (filter !== "TOUS") reloadParams.set("statut", filter)
    if (anneeFilter)       reloadParams.set("anneeId", anneeFilter)
    const fresh = await fetch(`/api/dossiers?${reloadParams}`).then((r) => r.json())
    setDossiers(fresh.dossiers ?? [])
    setBatch(false)
    setTimeout(() => setBatchResult(null), 4000)
  }

  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "32px 36px" }}>

      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "28px", fontWeight: 600, color: "#f8fafc", margin: "0 0 6px" }}>
          {t("admin.dossiersList.title")}
        </h1>
        <p style={{ fontSize: "13px", color: "#64748b" }}>
          {loading ? t("common.loading") : t("admin.dossiersList.found", { count: String(filtered.length) })}
        </p>
      </div>

      {/* Year selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569" }}>
          Année
        </span>
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
          {annees.map(a => {
            const isSelected = anneeFilter === a.id
            const color = a.active ? "#4ade80" : a.archivee ? "#64748b" : "#f5c842"
            return (
              <button key={a.id} onClick={() => setAnneeFilter(a.id)} style={{ padding: "5px 14px", borderRadius: "8px", border: `1px solid ${isSelected ? color : "rgba(255,255,255,0.08)"}`, background: isSelected ? `${color}18` : "transparent", color: isSelected ? color : "#475569", fontSize: "12.5px", fontWeight: isSelected ? 700 : 400, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                {a.libelle}
                {a.active && <span style={{ marginLeft: "5px", fontSize: "9px", opacity: 0.8 }}>●</span>}
              </button>
            )
          })}
        </div>
        {annees.length === 0 && <span style={{ fontSize: "12px", color: "#334155" }}>Aucune année académique</span>}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: filtersOpen ? "12px" : "24px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "4px", background: "rgba(10,20,42,0.6)", borderRadius: "12px", padding: "4px", border: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap" }}>
          {STATUTS.map((s) => {
            const cfg = s === "TOUS" ? null : STATUT_CFG[s]
            return (
              <button key={s} onClick={() => setFilter(s)} style={{ padding: "7px 14px", borderRadius: "9px", border: "none", background: filter === s ? (cfg ? cfg.bg : "rgba(255,255,255,0.08)") : "transparent", color: filter === s ? (cfg ? cfg.color : "#f8fafc") : "#475569", fontSize: "12px", fontWeight: filter === s ? 700 : 400, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                {s === "TOUS" ? t("admin.dossiersList.all") : (cfg?.label ?? s)}
              </button>
            )
          })}
        </div>
        <input type="text" placeholder={t("admin.dossiersList.search")} value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: "220px", padding: "9px 16px", borderRadius: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f8fafc", fontSize: "13px", outline: "none", fontFamily: "inherit" }}/>
        <button
          onClick={() => setFiltersOpen(o => !o)}
          style={{ display:"flex", alignItems:"center", gap:"6px", padding:"9px 14px", borderRadius:"10px", background: hasAdvancedFilters ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.04)", border: hasAdvancedFilters ? "1px solid rgba(167,139,250,0.35)" : "1px solid rgba(255,255,255,0.08)", color: hasAdvancedFilters ? "#a78bfa" : "#64748b", fontSize:"12.5px", fontWeight:600, cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}
        >
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z"/></svg>
          {t("admin.dossiersList.advancedFilters.btn")}{hasAdvancedFilters ? ` (${[filiereFilter,bacFilter,scoreMin,scoreMax,dateFrom,dateTo].filter(Boolean).length})` : ""}
        </button>
        <button onClick={exportCSV} disabled={filtered.length === 0} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"9px 16px", borderRadius:"10px", background:"rgba(74,222,128,0.1)", border:"1px solid rgba(74,222,128,0.25)", color:"#4ade80", fontSize:"12.5px", fontWeight:600, cursor:filtered.length===0?"not-allowed":"pointer", fontFamily:"inherit", opacity:filtered.length===0?0.4:1, flexShrink:0, whiteSpace:"nowrap" }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
          CSV ({filtered.length})
        </button>
      </div>

      {/* Advanced filter panel */}
      {filtersOpen && (
        <div style={{ padding: "16px 20px", borderRadius: "14px", background: "rgba(10,20,42,0.7)", border: "1px solid rgba(167,139,250,0.2)", marginBottom: "20px", display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "flex-end" }}>
          {/* Filière */}
          <div style={{ minWidth: "180px" }}>
            <label style={{ display:"block", fontSize:"9.5px", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"#475569", marginBottom:"5px" }}>{t("admin.dossiersList.advancedFilters.filiere")}</label>
            <select value={filiereFilter} onChange={e => setFiliereFilter(e.target.value)} style={{ width:"100%", padding:"7px 10px", borderRadius:"8px", background:"#0d1b35", border:"1px solid rgba(255,255,255,0.12)", color:"#f8fafc", fontSize:"12px", outline:"none", fontFamily:"inherit", cursor:"pointer", colorScheme:"dark" }}>
              <option value="">{t("admin.dossiersList.advancedFilters.allFilieres")}</option>
              {filieres.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
            </select>
          </div>
          {/* BAC series */}
          <div style={{ minWidth: "150px" }}>
            <label style={{ display:"block", fontSize:"9.5px", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"#475569", marginBottom:"5px" }}>{t("admin.dossiersList.advancedFilters.bacSerie")}</label>
            <select value={bacFilter} onChange={e => setBacFilter(e.target.value)} style={{ width:"100%", padding:"7px 10px", borderRadius:"8px", background:"#0d1b35", border:"1px solid rgba(255,255,255,0.12)", color:"#f8fafc", fontSize:"12px", outline:"none", fontFamily:"inherit", cursor:"pointer", colorScheme:"dark" }}>
              <option value="">{t("admin.dossiersList.advancedFilters.allSeries")}</option>
              {BAC_SERIES.map(s => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ")}</option>)}
            </select>
          </div>
          {/* Score range */}
          <div>
            <label style={{ display:"block", fontSize:"9.5px", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"#475569", marginBottom:"5px" }}>{t("admin.dossiersList.advancedFilters.scoreRange")}</label>
            <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
              <input type="number" min="0" max="100" placeholder="Min" value={scoreMin} onChange={e => setScoreMin(e.target.value)} style={{ width:"64px", padding:"7px 8px", borderRadius:"8px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#f8fafc", fontSize:"12px", outline:"none", fontFamily:"inherit", textAlign:"center" }}/>
              <span style={{ color:"#334155", fontSize:"11px" }}>–</span>
              <input type="number" min="0" max="100" placeholder="Max" value={scoreMax} onChange={e => setScoreMax(e.target.value)} style={{ width:"64px", padding:"7px 8px", borderRadius:"8px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#f8fafc", fontSize:"12px", outline:"none", fontFamily:"inherit", textAlign:"center" }}/>
            </div>
          </div>
          {/* Date range */}
          <div>
            <label style={{ display:"block", fontSize:"9.5px", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"#475569", marginBottom:"5px" }}>{t("admin.dossiersList.advancedFilters.dateRange")}</label>
            <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding:"7px 8px", borderRadius:"8px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color: dateFrom ? "#f8fafc" : "#64748b", fontSize:"12px", outline:"none", fontFamily:"inherit", colorScheme:"dark" }}/>
              <span style={{ color:"#334155", fontSize:"11px" }}>–</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding:"7px 8px", borderRadius:"8px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color: dateTo ? "#f8fafc" : "#64748b", fontSize:"12px", outline:"none", fontFamily:"inherit", colorScheme:"dark" }}/>
            </div>
          </div>
          {/* Clear button */}
          {hasAdvancedFilters && (
            <button onClick={clearAdvanced} style={{ padding:"7px 14px", borderRadius:"8px", border:"1px solid rgba(248,113,113,0.25)", background:"rgba(248,113,113,0.07)", color:"#f87171", fontSize:"12px", cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>
              {t("admin.dossiersList.advancedFilters.clear")}
            </button>
          )}
        </div>
      )}

      {/* Batch action bar */}
      {selected.size > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 18px", borderRadius: "12px", background: "rgba(245,200,66,0.07)", border: "1px solid rgba(245,200,66,0.2)", marginBottom: "16px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#f5c842" }}>
            {selected.size} {t("admin.batch.selected")}
          </span>
          {availableBatch.length > 0 ? (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {availableBatch.map((action) => (
                <button key={action.statut} onClick={() => runBatch(action.statut)} disabled={batchLoading} style={{ padding: "7px 16px", borderRadius: "9px", border: `1px solid ${action.color}30`, background: action.bg, color: action.color, fontSize: "12px", fontWeight: 700, cursor: batchLoading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                  {batchLoading ? "…" : action.label}
                </button>
              ))}
            </div>
          ) : (
            <span style={{ fontSize: "12px", color: "#475569" }}>{t("admin.batch.noAction")}</span>
          )}
          <button onClick={() => setSelected(new Set())} style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#64748b", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}>
            {t("common.cancel")}
          </button>
        </div>
      )}

      {batchResult && (
        <div style={{ padding: "10px 16px", borderRadius: "10px", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", fontSize: "13px", color: "#4ade80", marginBottom: "16px" }}>
          {batchResult}
        </div>
      )}

      {/* Table */}
      <div style={{ borderRadius: "18px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "36px 2fr 2fr 1fr 1fr 80px 100px", padding: "12px 20px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)", alignItems: "center" }}>
          {/* Select all checkbox */}
          <div>
            <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} style={{ width: "15px", height: "15px", accentColor: "#f5c842", cursor: "pointer" }}/>
          </div>
          {[
            t("admin.dossiersList.headers.student"),
            t("admin.dossiersList.headers.filiere"),
            t("admin.dossiersList.headers.documents"),
            t("admin.dossiersList.headers.score"),
            t("admin.dossiersList.headers.status"),
            t("admin.dossiersList.headers.action"),
          ].map((h) => (
            <div key={h} style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569" }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {[1,2,3].map((i) => <div key={i} style={{ height: "60px", borderBottom: "1px solid rgba(255,255,255,0.04)", animation: "pulse 1.5s ease-in-out infinite" }}/>)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#334155", fontSize: "13px" }}>
            {t("admin.dossiersList.noResult")}
          </div>
        ) : (
          filtered.map((d, idx) => {
            const cfg      = STATUT_CFG[d.statut] ?? STATUT_CFG.SOUMIS
            const name     = [d.etudiant.prenom, d.etudiant.nom].filter(Boolean).join(" ") || d.etudiant.email
            const isSelected = selected.has(d.id)
            return (
              <div key={d.id} style={{ display: "grid", gridTemplateColumns: "36px 2fr 2fr 1fr 1fr 80px 100px", padding: "14px 20px", alignItems: "center", borderBottom: idx < filtered.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", background: isSelected ? "rgba(245,200,66,0.04)" : idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)", transition: "background 0.15s" }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(245,200,66,0.03)" }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                {/* Row checkbox */}
                <div onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={isSelected} onChange={() => toggleOne(d.id)} style={{ width: "15px", height: "15px", accentColor: "#f5c842", cursor: "pointer" }}/>
                </div>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#f8fafc" }}>{name}</div>
                  <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>{d.etudiant.email}</div>
                </div>
                <div>
                  <div style={{ fontSize: "13px", color: "#94a3b8" }}>{d.filiere?.nom ?? "—"}</div>
                  {annees.length > 1 && <div style={{ fontSize: "10px", color: "#334155", marginTop: "2px" }}>{d.annee?.libelle}</div>}
                </div>
                <div style={{ fontSize: "13px", color: "#64748b" }}>{d._count?.documents ?? 0} doc{(d._count?.documents ?? 0) !== 1 ? "s" : ""}</div>
                <div style={{ fontSize: "13px", color: d.score !== null ? "#f5c842" : "#334155" }}>
                  {d.score !== null ? `${Math.round(d.score)}/100` : "—"}
                </div>
                <div>
                  <span style={{ padding: "3px 10px", borderRadius: "20px", background: cfg.bg, color: cfg.color, fontSize: "11px", fontWeight: 600 }}>{cfg.label}</span>
                </div>
                <div>
                  <Link href={`/admin/dossiers/${d.id}`} style={{ fontSize: "12px", color: "#60a5fa", textDecoration: "none", fontWeight: 600, padding: "5px 12px", borderRadius: "8px", background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.2)" }}>
                    {t("admin.dossiersList.examine")}
                  </Link>
                </div>
              </div>
            )
          })
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100% { opacity:0.6 } 50% { opacity:0.3 } }`}</style>
    </div>
  )
}

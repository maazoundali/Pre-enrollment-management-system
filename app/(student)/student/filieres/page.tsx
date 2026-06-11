"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useI18n } from "@/lib/i18n-context"
import { SkeletonStyles, SkeletonFiliereCard } from "@/components/Skeleton"
import CompareModal, { type FiliereSummary } from "@/components/CompareModal"

type CapaciteStatut = "OUVERT" | "REDUIT" | "LIMITE" | "COMPLET"

interface Filiere {
  id: string; nom: string; categorie: string | null; capacite: number | null; inscrits: number | null
  estComplete: boolean; tauxRemplissage: number
  capaciteStatut?: CapaciteStatut
  description: string | null; programme: string | null
  duree: string | null; diplomeDelivre: string | null
  langue: string | null; fraisInscription: number | null
}

const CATEGORY_URLS: Record<string, string> = {
  preparatoire: "https://iit.tn/prepa/",
  architecture: "https://iit.tn/architecture-2/",
  licence:      "https://iit.tn/licences/",
  master:       "https://iit.tn/mastere/",
  ingenierie:   "https://iit.tn/filieres-ingenieur/",
}

const STATUT_COLORS: Record<CapaciteStatut, { color: string; bg: string }> = {
  OUVERT:  { color: "#4ade80", bg: "rgba(74,222,128,0.12)" },
  REDUIT:  { color: "#f5c842", bg: "rgba(245,200,66,0.12)" },
  LIMITE:  { color: "#fb923c", bg: "rgba(251,146,60,0.12)" },
  COMPLET: { color: "#f87171", bg: "rgba(248,113,113,0.12)" },
}

export default function StudentFilieresPage() {
  const { t } = useI18n()
  const [filieres, setFilieres]     = useState<Filiere[]>([])
  const [loading, setLoading]       = useState(true)
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [search, setSearch]         = useState("")
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set())
  const [showCompare, setShowCompare] = useState(false)

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) }
      else if (next.size < 2) { next.add(id) }
      return next
    })
  }

  const GROUPS: { key: string; label: string; subtitle: string; color: string; keywords: string[] }[] = [
    { key: "preparatoire", label: t("student.filieres.groups.preparatoire.label"), subtitle: t("student.filieres.groups.preparatoire.subtitle"), color: "#f5c842", keywords: ["préparatoire", "preparatoire"] },
    { key: "ingenierie",   label: t("student.filieres.groups.ingenierie.label"),   subtitle: t("student.filieres.groups.ingenierie.subtitle"),   color: "#60a5fa", keywords: ["génie", "genie"] },
    { key: "licence",      label: t("student.filieres.groups.licence.label"),      subtitle: t("student.filieres.groups.licence.subtitle"),      color: "#a78bfa", keywords: ["licence"] },
    { key: "master",       label: t("student.filieres.groups.master.label"),       subtitle: t("student.filieres.groups.master.subtitle"),       color: "#4ade80", keywords: ["master"] },
    { key: "architecture", label: t("student.filieres.groups.architecture.label"), subtitle: t("student.filieres.groups.architecture.subtitle"), color: "#fb923c", keywords: ["architecture"] },
  ]

  function getGroup(f: Filiere): string {
    if (f.categorie && GROUPS.some((g) => g.key === f.categorie)) return f.categorie
    const nom = f.nom.toLowerCase()
    for (const g of GROUPS) if (g.keywords.some((kw) => nom.includes(kw))) return g.key
    return "other"
  }

  useEffect(() => {
    fetch("/api/filieres").then((r) => r.json()).then((d) => setFilieres(d.filieres ?? [])).finally(() => setLoading(false))
  }, [])

  const filtered = filieres.filter((f) =>
    !search || f.nom.toLowerCase().includes(search.toLowerCase()) || f.diplomeDelivre?.toLowerCase().includes(search.toLowerCase())
  )
  const availableCount = filtered.filter((f) => !f.estComplete).length

  function toggleGroup(key: string) {
    setOpenGroups((p) => { const next = new Set(p); next.has(key) ? next.delete(key) : next.add(key); return next })
  }

  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "36px 40px" }}>
      {showCompare && compareIds.size === 2 && (() => {
        const [idA, idB] = [...compareIds]
        const fA = filieres.find((f) => f.id === idA)
        const fB = filieres.find((f) => f.id === idB)
        if (fA && fB) return <CompareModal items={[fA as FiliereSummary, fB as FiliereSummary]} onClose={() => setShowCompare(false)} />
      })()}
      <SkeletonStyles />
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:translateY(0) } }`}</style>

      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: "28px", fontWeight: 600, color: "#f8fafc", margin: "0 0 8px" }}>
          {t("student.filieres.title")}
        </h1>
        <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
          {loading ? t("common.loading") : t("student.filieres.availableCount", { count: String(availableCount) })}
        </p>
      </div>

      {/* Compare bar */}
      {compareIds.size > 0 && (
        <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"10px 16px", borderRadius:"12px", background:"rgba(96,165,250,0.07)", border:"1px solid rgba(96,165,250,0.2)", marginBottom:"20px" }}>
          <span style={{ fontSize:"13px", color:"#60a5fa" }}>
            {compareIds.size === 1 ? t("compare.selectOne") : t("compare.ready")}
          </span>
          {compareIds.size === 2 && (
            <button onClick={() => setShowCompare(true)} style={{ padding:"7px 18px", borderRadius:"9px", border:"none", background:"linear-gradient(135deg,#60a5fa,#3b82f6)", color:"#fff", fontSize:"12px", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              {t("compare.compareBtn")}
            </button>
          )}
          <button onClick={() => setCompareIds(new Set())} style={{ marginLeft:"auto", padding:"5px 12px", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.1)", background:"transparent", color:"#64748b", fontSize:"12px", cursor:"pointer", fontFamily:"inherit" }}>
            {t("common.cancel")}
          </button>
        </div>
      )}

      {/* Search */}
      <div style={{ marginBottom: "28px", maxWidth: "400px" }}>
        <div style={{ position: "relative" }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#475569" strokeWidth={2} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input type="text" placeholder={t("student.filieres.title")} value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: "100%", padding: "10px 14px 10px 40px", borderRadius: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f8fafc", fontSize: "13px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}/>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1,2,3,4].map((i) => <SkeletonFiliereCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: "56px 24px", borderRadius: "16px", background: "rgba(10,20,42,0.4)", border: "1px dashed rgba(255,255,255,0.08)", textAlign: "center" }}>
          <div style={{ fontSize: "15px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>{t("student.filieres.noResult")}</div>
          <div style={{ fontSize: "13px", color: "#334155" }}>{t("student.filieres.noResultHint")}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {GROUPS.map((group) => {
            const groupFilieres = filtered.filter((f) => getGroup(f) === group.key)
            if (groupFilieres.length === 0) return null
            const isOpen = openGroups.has(group.key)
            const available = groupFilieres.filter((f) => !f.estComplete).length

            return (
              <div key={group.key} style={{ borderRadius: "20px", background: "rgba(10,20,42,0.55)", border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
                <div onClick={() => toggleGroup(group.key)} style={{ padding: "18px 24px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", borderBottom: isOpen ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div style={{ width: "3px", height: "36px", borderRadius: "3px", background: group.color, flexShrink: 0 }}/>
                    <div>
                      <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: "17px", fontWeight: 600, color: "#f8fafc" }}>{group.label}</div>
                      <div style={{ fontSize: "11.5px", color: "#475569", marginTop: "2px" }}>{group.subtitle}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                    <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", background: `${group.color}12`, color: group.color, fontWeight: 600 }}>
                      {t("student.filieres.available", { avail: String(available), total: String(groupFilieres.length) })}
                    </span>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#475569" strokeWidth={2} style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7"/>
                    </svg>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: "8px", animation: "fadeIn 0.2s ease both" }}>
                    {groupFilieres.map((f) => (
                      <FiliereCard key={f.id} filiere={f} groupColor={group.color} expanded={expanded === f.id} onToggle={() => setExpanded(expanded === f.id ? null : f.id)} t={t} inCompare={compareIds.has(f.id)} canCompare={compareIds.size < 2 || compareIds.has(f.id)} onCompare={() => toggleCompare(f.id)}/>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FiliereCard({ filiere: f, groupColor, expanded, onToggle, t, inCompare, canCompare, onCompare }: {
  filiere: Filiere; groupColor: string; expanded: boolean; onToggle: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
  inCompare: boolean; canCompare: boolean; onCompare: () => void
}) {
  const pct = Math.min(f.tauxRemplissage, 100)
  return (
    <div style={{ borderRadius: "14px", background: expanded ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.02)", border: expanded ? `1px solid ${groupColor}25` : "1px solid rgba(255,255,255,0.06)", opacity: f.estComplete ? 0.6 : 1, overflow: "hidden", transition: "all 0.2s" }}>
      <div onClick={onToggle} style={{ padding: "14px 18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: f.estComplete ? "#64748b" : "#f8fafc" }}>{f.nom}</span>
            {f.estComplete && <span style={{ fontSize: "10px", padding: "1px 7px", borderRadius: "20px", background: "rgba(248,113,113,0.1)", color: "#f87171", fontWeight: 600 }}>{t("student.filieres.full")}</span>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {f.duree           && <Chip label={f.duree} color="#60a5fa"/>}
            {f.langue          && <Chip label={f.langue} color="#a78bfa"/>}
            {f.fraisInscription != null && <Chip label={`${f.fraisInscription.toLocaleString()} DT/an`} color="#4ade80"/>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexShrink: 0 }}>
          <div style={{ textAlign: "right" }}>
            {f.capaciteStatut ? (
              <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", background: STATUT_COLORS[f.capaciteStatut].bg, color: STATUT_COLORS[f.capaciteStatut].color }}>
                {t(`student.filieres.capaciteStatut.${f.capaciteStatut}`)}
              </span>
            ) : (
              <>
                <div style={{ fontSize: "12px", color: f.estComplete ? "#f87171" : groupColor, fontWeight: 600 }}>{f.inscrits}/{f.capacite}</div>
                <div style={{ width: "64px", height: "3px", borderRadius: "3px", background: "rgba(255,255,255,0.07)", marginTop: "4px", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: "3px", background: pct > 80 ? "#f87171" : groupColor }}/>
                </div>
              </>
            )}
          </div>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#475569" strokeWidth={2} style={{ transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7"/>
          </svg>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: "16px 18px", borderTop: "1px solid rgba(255,255,255,0.05)", animation: "fadeIn 0.2s ease both" }}>
          {f.description && <p style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 14px", lineHeight: 1.7 }}>{f.description}</p>}
          {f.programme && (
            <div style={{ marginBottom: "16px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", marginBottom: "8px" }}>{t("student.filieres.programme")}</div>
              <p style={{ fontSize: "12.5px", color: "#94a3b8", margin: 0, lineHeight: 1.75 }}>{f.programme}</p>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: "8px", marginTop: "14px" }}>
            {[
              { label: t("student.filieres.details.diplome"),   value: f.diplomeDelivre },
              { label: t("student.filieres.details.duree"),     value: f.duree },
              { label: t("student.filieres.details.langue"),    value: f.langue },
              { label: t("student.filieres.details.frais"),     value: f.fraisInscription != null ? `${f.fraisInscription.toLocaleString()} DT/an` : null },
              { label: t("student.filieres.details.places"), value: f.capaciteStatut ? t(`student.filieres.capaciteStatut.${f.capaciteStatut}`) : (f.estComplete ? t("student.filieres.full") : t("student.filieres.details.placesAvail", { n: String((f.capacite ?? 0) - (f.inscrits ?? 0)) })) },
            ].filter((i) => i.value).map(({ label, value }) => (
              <div key={label} style={{ padding: "9px 11px", borderRadius: "9px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "9.5px", color: "#475569", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "3px" }}>{label}</div>
                <div style={{ fontSize: "12.5px", color: "#f8fafc", fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>
            <div style={{ marginTop: "16px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {f.categorie && CATEGORY_URLS[f.categorie] && (
            <a href={CATEGORY_URLS[f.categorie]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "9px 18px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.05)", color: "#94a3b8", fontSize: "12.5px", fontWeight: 600, textDecoration: "none" }}>
              {t("student.filieres.apply")}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            </a>
          )}
          {!f.estComplete && (
            <Link href="/student/dossier/new" style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "9px 18px", borderRadius: "10px", background: "linear-gradient(135deg,#f5c842,#e8a820)", color: "#060d1f", fontSize: "12.5px", fontWeight: 700, textDecoration: "none" }}>
              {t("student.filieres.postuler")}
            </Link>
          )}
          <button onClick={(e) => { e.stopPropagation(); onCompare() }} disabled={!canCompare} style={{ padding:"7px 14px", borderRadius:"10px", border: inCompare ? "1px solid rgba(96,165,250,0.5)" : "1px solid rgba(255,255,255,0.12)", background: inCompare ? "rgba(96,165,250,0.12)" : "rgba(255,255,255,0.04)", color: inCompare ? "#60a5fa" : "#64748b", fontSize:"11.5px", cursor: canCompare ? "pointer" : "not-allowed", fontFamily:"inherit", opacity: canCompare ? 1 : 0.5 }}>
            {inCompare ? t("compare.remove") : t("compare.add")}
          </button>
        </div>
        </div>
      )}
    </div>
  )
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: "10.5px", padding: "2px 7px", borderRadius: "5px", background: `${color}10`, color, border: `1px solid ${color}20` }}>
      {label}
    </span>
  )
}

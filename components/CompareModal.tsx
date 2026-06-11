"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useI18n } from "@/lib/i18n-context"

export interface FiliereSummary {
  id: string; nom: string; capacite: number; inscrits: number
  estComplete: boolean; tauxRemplissage: number
  description: string | null; programme: string | null
  duree: string | null; diplomeDelivre: string | null
  langue: string | null; fraisInscription: number | null
}

interface Props {
  items: [FiliereSummary, FiliereSummary]
  onClose: () => void
}

export default function CompareModal({ items, onClose }: Props) {
  const { t } = useI18n()
  const [a, b] = items

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  function Row({ label, va, vb, highlight }: { label: string; va: string; vb: string; highlight?: boolean }) {
    const diff = va !== vb
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#475569", display: "flex", alignItems: "center" }}>{label}</div>
        <div style={{ fontSize: "13px", color: highlight && diff ? "#f5c842" : "#f8fafc", fontWeight: highlight ? 600 : 400, padding: "4px 8px", borderRadius: "6px", background: highlight && diff ? "rgba(245,200,66,0.06)" : "transparent" }}>{va || "—"}</div>
        <div style={{ fontSize: "13px", color: highlight && diff ? "#60a5fa" : "#f8fafc", fontWeight: highlight ? 600 : 400, padding: "4px 8px", borderRadius: "6px", background: highlight && diff ? "rgba(96,165,250,0.06)" : "transparent" }}>{vb || "—"}</div>
      </div>
    )
  }

  const pct = (f: FiliereSummary) => `${Math.min(f.tauxRemplissage, 100)}%`

  return (
    <>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}} @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(8px)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px", animation:"fadeIn 0.2s ease both" }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width:"100%", maxWidth:"780px", maxHeight:"90vh", overflowY:"auto", borderRadius:"22px", background:"rgba(8,16,36,0.98)", border:"1px solid rgba(255,255,255,0.1)", boxShadow:"0 32px 80px rgba(0,0,0,0.7)", animation:"slideUp 0.25s ease both" }}>

          {/* Header */}
          <div style={{ padding:"24px 28px 20px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px", alignItems:"start" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
              <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"17px", fontWeight:600, color:"#f8fafc", margin:0 }}>{t("compare.title")}</h2>
              <button onClick={onClose} style={{ marginLeft:"auto", width:"28px", height:"28px", borderRadius:"8px", border:"none", background:"rgba(255,255,255,0.06)", color:"#94a3b8", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px" }}>×</button>
            </div>
            <div>
              <div style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"15px", fontWeight:600, color:"#f5c842", marginBottom:"4px" }}>{a.nom}</div>
              {a.estComplete && <span style={{ fontSize:"10px", padding:"1px 7px", borderRadius:"20px", background:"rgba(248,113,113,0.1)", color:"#f87171" }}>{t("student.filieres.full")}</span>}
            </div>
            <div>
              <div style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"15px", fontWeight:600, color:"#60a5fa", marginBottom:"4px" }}>{b.nom}</div>
              {b.estComplete && <span style={{ fontSize:"10px", padding:"1px 7px", borderRadius:"20px", background:"rgba(248,113,113,0.1)", color:"#f87171" }}>{t("student.filieres.full")}</span>}
            </div>
          </div>

          {/* Comparison rows */}
          <div style={{ padding:"16px 28px 24px" }}>
            <Row label={t("student.filieres.details.diplome")}  va={a.diplomeDelivre ?? ""}        vb={b.diplomeDelivre ?? ""}        highlight />
            <Row label={t("student.filieres.details.duree")}    va={a.duree ?? ""}                 vb={b.duree ?? ""}                 highlight />
            <Row label={t("student.filieres.details.langue")}   va={a.langue ?? ""}                vb={b.langue ?? ""}                highlight />
            <Row label={t("student.filieres.details.frais")}    va={a.fraisInscription != null ? `${a.fraisInscription.toLocaleString()} DT/an` : ""} vb={b.fraisInscription != null ? `${b.fraisInscription.toLocaleString()} DT/an` : ""} highlight />
            <Row label={t("student.filieres.details.capacite")} va={`${a.capacite}`}               vb={`${b.capacite}`} />
            <Row label={t("compare.enrolled")}                  va={`${a.inscrits}/${a.capacite}`} vb={`${b.inscrits}/${b.capacite}`} />

            {/* Fill rate bars */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px", padding:"10px 0", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:"#475569", display:"flex", alignItems:"center" }}>{t("compare.fillRate")}</div>
              {[a, b].map((f, i) => (
                <div key={f.id}>
                  <div style={{ height:"6px", borderRadius:"6px", background:"rgba(255,255,255,0.07)", overflow:"hidden", marginBottom:"4px" }}>
                    <div style={{ width:pct(f), height:"100%", borderRadius:"6px", background: f.tauxRemplissage > 80 ? "#f87171" : i === 0 ? "#f5c842" : "#60a5fa", transition:"width 0.6s ease" }}/>
                  </div>
                  <div style={{ fontSize:"12px", color: f.tauxRemplissage > 80 ? "#f87171" : "#64748b" }}>{pct(f)}</div>
                </div>
              ))}
            </div>

            {/* Descriptions */}
            {(a.description || b.description) && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px", padding:"12px 0", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:"#475569" }}>{t("compare.description")}</div>
                <div style={{ fontSize:"12.5px", color:"#94a3b8", lineHeight:1.65 }}>{a.description ?? "—"}</div>
                <div style={{ fontSize:"12.5px", color:"#94a3b8", lineHeight:1.65 }}>{b.description ?? "—"}</div>
              </div>
            )}

            {/* CTA */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"12px", paddingTop:"16px" }}>
              <div/>
              {[a, b].map((f) => (
                !f.estComplete ? (
                  <Link key={f.id} href="/student/dossier/new" onClick={onClose} style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", gap:"6px", padding:"10px 18px", borderRadius:"10px", background:"linear-gradient(135deg,#f5c842,#e8a820)", color:"#060d1f", fontSize:"12.5px", fontWeight:700, textDecoration:"none" }}>
                    {t("student.filieres.apply")}
                  </Link>
                ) : (
                  <div key={f.id} style={{ fontSize:"12px", color:"#334155", display:"flex", alignItems:"center" }}>{t("student.filieres.full")}</div>
                )
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

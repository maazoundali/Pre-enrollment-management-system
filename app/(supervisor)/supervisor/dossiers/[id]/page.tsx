"use client"

import { useEffect, useState, useRef } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useI18n } from "@/lib/i18n-context"

interface NoteInterne {
  id: string; contenu: string; dateCreation: string
  auteur: { nom: string | null; prenom: string | null; email: string }
}

interface Dossier {
  id: string; statut: string; score: number | null; dateCreation: string; dateMaj: string; motifRejet?: string | null
  niveauEtude?: string | null; typeCours?: string | null; notes?: Record<string, number> | null
  etudiant: { nom: string | null; prenom: string | null; email: string; dateNaissance?: string | null; sexe?: string | null; pays?: string | null; telephone?: string | null }
  filiere: { nom: string; duree?: string | null; langue?: string | null; fraisInscription?: number | null } | null
  diplomes: { intitule: string; annee: number; etablissement?: string | null; type?: string | null; sousType?: string | null; champs?: Record<string, unknown> | null }[]
  documents: { id: string; type: string; nom: string }[]
  analyses: { score: number; complet: boolean; resultat: string; filiereRecommandations: { rang: number; filiere: { nom: string } }[] }[]
}

const GRADE_LABELS: Record<string, string> = {
  math:"Mathématiques", physique:"Physique", francais:"Français", anglais:"Anglais",
  informatique:"Informatique", gestion:"Gestion", philosophie:"Philosophie",
  histoire_geo:"Histoire-Géo", moyenneGenerale:"Moyenne générale",
}

export default function SupervisorDossierDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t, locale, dir } = useI18n()
  const [dossier, setDossier] = useState<Dossier | null>(null)
  const [loading, setLoading] = useState(true)

  const [notes, setNotes]         = useState<NoteInterne[]>([])
  const [noteInput, setNoteInput] = useState("")
  const [addingNote, setAddingNote] = useState(false)
  const [noteError, setNoteError]   = useState("")
  const notesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/dossiers/${id}`).then(r => r.json()).then(d => setDossier(d.dossier)).finally(() => setLoading(false))
    fetch(`/api/dossiers/${id}/notes`).then(r => r.json()).then(d => setNotes(d.notes ?? []))
  }, [id])

  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [notes])

  async function submitNote() {
    if (!noteInput.trim()) return
    setAddingNote(true); setNoteError("")
    try {
      const res = await fetch(`/api/dossiers/${id}/notes`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenu: noteInput.trim() }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? t("common.error")) }
      const { note } = await res.json()
      setNotes(p => [note, ...p])
      setNoteInput("")
    } catch (e: unknown) {
      setNoteError(e instanceof Error ? e.message : t("common.error"))
    } finally { setAddingNote(false) }
  }

  const STATUT_CFG: Record<string, { label: string; color: string; bg: string }> = {
    BROUILLON:     { label: t("statut.BROUILLON.label"),    color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
    SOUMIS:        { label: t("statut.SOUMIS.label"),        color: "#60a5fa", bg: "rgba(96,165,250,0.12)"  },
    EN_ANALYSE:    { label: t("statut.EN_ANALYSE.label"),    color: "#f5c842", bg: "rgba(245,200,66,0.12)"  },
    VALIDE:        { label: t("statut.VALIDE.label"),        color: "#4ade80", bg: "rgba(74,222,128,0.12)"  },
    REJETE:        { label: t("statut.REJETE.label"),        color: "#f87171", bg: "rgba(248,113,113,0.12)" },
    LISTE_ATTENTE: { label: t("statut.LISTE_ATTENTE.label"), color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", { day:"numeric", month:"long", year:"numeric" })
  const fmtShort = (d: string) => new Date(d).toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })
  const cardStyle: React.CSSProperties = { padding:"24px 28px", borderRadius:"18px", background:"rgba(10,20,42,0.65)", border:"1px solid rgba(255,255,255,0.07)", marginBottom:"16px" }
  const labelStyle: React.CSSProperties = { fontSize:"10px", color:"#475569", fontWeight:700, letterSpacing:"0.09em", textTransform:"uppercase", marginBottom:"4px" }
  const valueStyle: React.CSSProperties = { fontSize:"13px", color:"#f8fafc", fontWeight:500 }

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#070e20", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:"32px", height:"32px", borderRadius:"50%", border:"2px solid rgba(245,200,66,0.2)", borderTopColor:"#f5c842", animation:"spin 0.8s linear infinite" }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (!dossier) return (
    <div style={{ minHeight:"100vh", background:"#070e20", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <p style={{ color:"#475569" }}>{t("admin.dossierDetail.notFound")}</p>
    </div>
  )

  const cfg      = STATUT_CFG[dossier.statut] ?? STATUT_CFG.SOUMIS
  const fullName = [dossier.etudiant.prenom, dossier.etudiant.nom].filter(Boolean).join(" ") || dossier.etudiant.email
  const analyse  = dossier.analyses?.[0] ?? null

  return (
    <div dir={dir} style={{ minHeight:"100vh", background:"#070e20", padding:"32px 36px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }`}</style>

      <Link href="/supervisor/dossiers" style={{ display:"inline-flex", alignItems:"center", gap:"6px", color:"#64748b", fontSize:"13px", textDecoration:"none", marginBottom:"20px" }}>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ transform: dir === "rtl" ? "rotate(180deg)" : undefined }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"/>
        </svg>
        {t("supervisor.dossiers.title")}
      </Link>

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"28px" }}>
        <div>
          <h1 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"24px", fontWeight:600, color:"#f8fafc", margin:"0 0 4px" }}>{fullName}</h1>
          <p style={{ fontSize:"13px", color:"#475569" }}>{dossier.filiere?.nom ?? "—"} · {t("admin.dossierDetail.fields.creeLe")} {fmt(dossier.dateCreation)}</p>
        </div>
        <span style={{ padding:"6px 16px", borderRadius:"20px", background:cfg.bg, color:cfg.color, fontSize:"13px", fontWeight:600 }}>{cfg.label}</span>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:"16px" }}>
        <div>
          {/* Identity */}
          <div style={cardStyle}>
            <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"15px", fontWeight:500, color:"#f8fafc", margin:"0 0 16px" }}>{t("admin.dossierDetail.identity")}</h2>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
              {[
                { label: t("admin.dossierDetail.fields.email"),         value: dossier.etudiant.email },
                { label: t("admin.dossierDetail.fields.pays"),          value: dossier.etudiant.pays ?? "—" },
                { label: t("admin.dossierDetail.fields.telephone"),     value: dossier.etudiant.telephone ?? "—" },
                { label: t("admin.dossierDetail.fields.dateSoumission"),value: fmt(dossier.dateCreation) },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding:"10px 12px", borderRadius:"10px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={labelStyle}>{label}</div>
                  <div style={valueStyle}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Academic + Grades */}
          <div style={cardStyle}>
            <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"15px", fontWeight:500, color:"#f8fafc", margin:"0 0 16px" }}>{t("admin.dossierDetail.academic")}</h2>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"14px" }}>
              {[
                { label: t("admin.dossierDetail.fields.niveauActuel"),   value: dossier.niveauEtude ?? "—" },
                { label: t("admin.dossierDetail.fields.filiereChoisie"), value: dossier.filiere?.nom ?? "—" },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding:"10px 12px", borderRadius:"10px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={labelStyle}>{label}</div>
                  <div style={valueStyle}>{value}</div>
                </div>
              ))}
            </div>
            {dossier.diplomes.length > 0 && (
              <div>
                <div style={{ fontSize:"10px", fontWeight:700, letterSpacing:"0.09em", textTransform:"uppercase", color:"#475569", marginBottom:"8px" }}>{t("admin.dossierDetail.fields.diplomes")}</div>
                {dossier.diplomes.map((d, i) => (
                  <div key={i} style={{ marginBottom:"8px", padding:"10px 12px", borderRadius:"10px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom: d.champs ? "8px" : 0 }}>
                      <span style={{ fontSize:"13px", fontWeight:600, color:"#f8fafc" }}>{d.intitule}</span>
                      <span style={{ fontSize:"12px", color:"#f5c842", fontWeight:600 }}>{d.annee}</span>
                    </div>
                    {d.champs && Object.keys(d.champs).length > 0 && (
                      <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                        {Object.entries(d.champs as Record<string, number>).filter(([k]) => !k.startsWith("__")).map(([key, val]) => (
                          <div key={key} style={{ padding:"3px 9px", borderRadius:"7px", background:"rgba(245,200,66,0.08)", border:"1px solid rgba(245,200,66,0.15)", fontSize:"11px" }}>
                            <span style={{ color:"#64748b" }}>{GRADE_LABELS[key] ?? key}</span>
                            <span style={{ color:"#f5c842", fontWeight:700, marginInlineStart:"5px" }}>{val}/20</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {dossier.notes && Object.keys(dossier.notes).length > 0 && (
              <div style={{ marginTop:"12px" }}>
                <div style={{ fontSize:"10px", fontWeight:700, letterSpacing:"0.09em", textTransform:"uppercase", color:"#475569", marginBottom:"8px" }}>{t("admin.dossierDetail.notesLabel")}</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                  {Object.entries(dossier.notes as Record<string, number>).filter(([k]) => !k.startsWith("__")).map(([key, val]) => (
                    <div key={key} style={{ padding:"4px 10px", borderRadius:"8px", background:"rgba(245,200,66,0.08)", border:"1px solid rgba(245,200,66,0.15)", fontSize:"12px" }}>
                      <span style={{ color:"#64748b" }}>{GRADE_LABELS[key] ?? key}</span>
                      <span style={{ color:"#f5c842", fontWeight:700, marginInlineStart:"6px" }}>{val}/20</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AI Analysis */}
          {analyse && (
            <div style={cardStyle}>
              <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"15px", fontWeight:500, color:"#f8fafc", margin:"0 0 16px" }}>{t("admin.dossierDetail.ai.title")}</h2>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}>
                <span style={{ fontSize:"13px", color:"#94a3b8" }}>{t("admin.dossierDetail.ai.score")}</span>
                <span style={{ fontSize:"22px", fontWeight:700, color: analyse.score >= 70 ? "#4ade80" : analyse.score >= 40 ? "#f5c842" : "#f87171" }}>
                  {Math.round(analyse.score)}<span style={{ fontSize:"12px", color:"#475569" }}>/100</span>
                </span>
              </div>
              <div style={{ height:"6px", borderRadius:"6px", background:"rgba(255,255,255,0.07)", overflow:"hidden", marginBottom:"14px" }}>
                <div style={{ width:`${analyse.score}%`, height:"100%", borderRadius:"6px", background: analyse.score >= 70 ? "linear-gradient(90deg,#4ade80,#22c55e)" : analyse.score >= 40 ? "linear-gradient(90deg,#f5c842,#e8a820)" : "linear-gradient(90deg,#f87171,#ef4444)" }}/>
              </div>
              <p style={{ fontSize:"12px", color:"#64748b", lineHeight:1.7, margin:"0 0 10px", fontStyle:"italic" }}>{analyse.resultat}</p>
              {analyse.filiereRecommandations.length > 0 && (
                <div style={{ display:"flex", flexDirection:"column", gap:"5px" }}>
                  {analyse.filiereRecommandations.map(r => (
                    <div key={r.filiere.nom} style={{ padding:"6px 11px", borderRadius:"8px", background: r.rang === 1 ? "rgba(245,200,66,0.08)" : "rgba(255,255,255,0.03)", border: r.rang === 1 ? "1px solid rgba(245,200,66,0.2)" : "1px solid rgba(255,255,255,0.06)", fontSize:"12px", color: r.rang === 1 ? "#f5c842" : "#94a3b8" }}>
                      {r.rang > 1 && <span style={{ color:"#475569", marginInlineEnd:"4px" }}>{r.rang}.</span>}{r.filiere.nom}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Internal notes */}
          <div style={cardStyle}>
            <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"15px", fontWeight:500, color:"#f8fafc", margin:"0 0 16px" }}>
              {t("supervisor.dossiers.notes.title")}
            </h2>

            {/* Add note */}
            <div style={{ marginBottom:"16px" }}>
              <textarea
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                placeholder={t("supervisor.dossiers.notes.placeholder")}
                rows={3}
                style={{ width:"100%", padding:"10px 12px", borderRadius:"10px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#f8fafc", fontSize:"13px", outline:"none", fontFamily:"inherit", resize:"vertical", boxSizing:"border-box" }}
              />
              {noteError && <p style={{ fontSize:"12px", color:"#f87171", margin:"4px 0 0" }}>{noteError}</p>}
              <div style={{ display:"flex", justifyContent:"flex-end", marginTop:"8px" }}>
                <button onClick={submitNote} disabled={addingNote || !noteInput.trim()} style={{ padding:"8px 18px", borderRadius:"9px", border:"none", background: addingNote || !noteInput.trim() ? "rgba(167,139,250,0.3)" : "linear-gradient(135deg,#a78bfa,#7c3aed)", color:"#fff", fontSize:"12.5px", fontWeight:700, cursor: addingNote || !noteInput.trim() ? "not-allowed" : "pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:"6px" }}>
                  {addingNote && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ animation:"spin 0.8s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="3" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></svg>}
                  {t("supervisor.dossiers.notes.add")}
                </button>
              </div>
            </div>

            {/* Notes list */}
            {notes.length === 0 ? (
              <p style={{ fontSize:"12px", color:"#334155", textAlign:"center", padding:"16px 0" }}>{t("supervisor.dossiers.notes.empty")}</p>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                {notes.map(n => {
                  const authorName = [n.auteur.prenom, n.auteur.nom].filter(Boolean).join(" ") || n.auteur.email
                  return (
                    <div key={n.id} style={{ padding:"12px 14px", borderRadius:"10px", background:"rgba(167,139,250,0.06)", border:"1px solid rgba(167,139,250,0.15)", animation:"fadeIn 0.2s ease both" }}>
                      <p style={{ fontSize:"13px", color:"#e2e8f0", margin:"0 0 8px", lineHeight:1.6, whiteSpace:"pre-wrap" }}>{n.contenu}</p>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontSize:"11px", color:"#a78bfa", fontWeight:600 }}>{authorName}</span>
                        <span style={{ fontSize:"10.5px", color:"#334155" }}>{fmtShort(n.dateCreation)}</span>
                      </div>
                    </div>
                  )
                })}
                <div ref={notesEndRef}/>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div>
          <div style={{ padding:"20px 22px", borderRadius:"16px", background:"rgba(10,20,42,0.8)", border:"1px solid rgba(255,255,255,0.08)", marginBottom:"12px" }}>
            <div style={{ fontSize:"10px", fontWeight:700, letterSpacing:"0.09em", textTransform:"uppercase", color:"#475569", marginBottom:"14px" }}>{t("admin.dossierDetail.summary")}</div>
            {[
              { label: t("admin.dossierDetail.fields.creeLe"),    value: fmt(dossier.dateCreation) },
              { label: t("admin.dossierDetail.fields.modifieLe"), value: fmt(dossier.dateMaj) },
              { label: t("admin.dossierDetail.docs.title", { count: String(dossier.documents.length) }), value: String(dossier.documents.length) },
            ].map(({ label, value }) => (
              <div key={label} style={{ display:"flex", justifyContent:"space-between", fontSize:"12px", marginBottom:"8px" }}>
                <span style={{ color:"#475569" }}>{label}</span>
                <span style={{ color:"#94a3b8" }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Documents list */}
          <div style={{ padding:"20px 22px", borderRadius:"16px", background:"rgba(10,20,42,0.8)", border:"1px solid rgba(255,255,255,0.08)", marginBottom:"12px" }}>
            <div style={{ fontSize:"10px", fontWeight:700, letterSpacing:"0.09em", textTransform:"uppercase", color:"#475569", marginBottom:"12px" }}>{t("admin.dossierDetail.docs.title", { count: String(dossier.documents.length) })}</div>
            {dossier.documents.length === 0 ? (
              <p style={{ fontSize:"12px", color:"#334155" }}>{t("admin.dossierDetail.docs.none")}</p>
            ) : dossier.documents.map(doc => (
              <div key={doc.id} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"7px 0", borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize:"10px", fontWeight:700, padding:"2px 7px", borderRadius:"5px", background:"rgba(245,200,66,0.1)", color:"#f5c842", flexShrink:0 }}>{doc.type}</span>
                <span style={{ fontSize:"11px", color:"#64748b", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{doc.nom}</span>
              </div>
            ))}
          </div>

          {/* Read-only badge */}
          <div style={{ padding:"10px 14px", borderRadius:"10px", background:"rgba(167,139,250,0.07)", border:"1px solid rgba(167,139,250,0.2)", fontSize:"11px", color:"#a78bfa", textAlign:"center" }}>
            🔒 {t("supervisor.dossiers.readOnly")}
          </div>
        </div>
      </div>
    </div>
  )
}

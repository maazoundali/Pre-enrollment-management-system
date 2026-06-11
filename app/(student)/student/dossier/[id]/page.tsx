"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useI18n } from "@/lib/i18n-context"
import { downloadDossierPDF } from "@/lib/generatePDF"
import { downloadAcceptanceLetter } from "@/lib/generateAcceptanceLetter"
import DocumentPreviewModal from "@/components/DocumentPreviewModal"

interface Document { id: string; type: string; nom: string; url: string; dateUpload: string; verification?: "VERIFIED"|"REJECTED"|"NEEDS_REUPLOAD"|null; verificationNote?: string|null }
interface FiliereRec { rang: number; filiere: { id: string; nom: string } }
interface Analyse { id: string; score: number; complet: boolean; resultat: string; dateAnalyse: string; filiereRecommandations: FiliereRec[] }
interface DiplomaEntry { intitule: string; annee: number | null; type: string | null; sousType: string | null; champs: Record<string, unknown> | null }
interface Dossier {
  id: string; statut: string; score: number | null
  dateCreation: string; dateMaj: string; motifRejet?: string | null
  niveauEtude?: string | null; typeCours?: string | null
  filiere: { id: string; nom: string; capacite: number; duree?: string | null; langue?: string | null; fraisInscription?: number | null } | null
  etudiant: { nom: string | null; prenom: string | null; email: string; dateNaissance?: string | null; typeIdentite?: string | null; numeroIdentite?: string | null; pays?: string | null; telephone?: string | null; adresse?: string | null }
  diplomes: DiplomaEntry[]
  documents: Document[]
  analyses: Analyse[]
}

const STEPS = ["BROUILLON", "SOUMIS", "EN_ANALYSE", "VALIDE"]

export default function DossierDetailPage() {
  const { id }         = useParams<{ id: string }>()
  const router         = useRouter()
  const searchParams   = useSearchParams()
  const { t, locale }  = useI18n()
  const justSubmitted  = searchParams.get("submitted") === "1"

  const [dossier, setDossier] = useState<Dossier | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [preview, setPreview] = useState<{ url: string; nom: string; type: string } | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/dossiers/${id}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((d) => { if (!d.dossier) throw new Error(); setDossier(d.dossier) })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false))
  }, [id])

  // When just submitted, show a brief "analysis in progress" state then clean the URL
  useEffect(() => {
    if (justSubmitted) {
      setAnalysisLoading(true)
      const timer = setTimeout(() => {
        setAnalysisLoading(false)
        // Remove ?submitted=1 so refreshing doesn't re-trigger this animation
        router.replace(`/student/dossier/${id}`, { scroll: false })
      }, 2800)
      return () => clearTimeout(timer)
    }
  }, [justSubmitted, id, router])

  const STATUT_CFG: Record<string, { label: string; color: string; bg: string }> = {
    BROUILLON:  { label: t("statut.BROUILLON.label"), color: "#94a3b8", bg: "rgba(148,163,184,0.1)" },
    SOUMIS:     { label: t("statut.SOUMIS.label"),     color: "#60a5fa", bg: "rgba(96,165,250,0.1)"  },
    EN_ANALYSE: { label: t("statut.EN_ANALYSE.label"), color: "#f5c842", bg: "rgba(245,200,66,0.1)"  },
    VALIDE:     { label: t("statut.VALIDE.label"),     color: "#4ade80", bg: "rgba(74,222,128,0.1)"  },
    REJETE:     { label: t("statut.REJETE.label"),     color: "#f87171", bg: "rgba(248,113,113,0.1)" },
  }

  const DOC_LABELS: Record<string, string> = {
    CNI: t("student.dossierDetail.docs.labels.CNI"),
    DIPLOME: t("student.dossierDetail.docs.labels.DIPLOME"),
    RELEVE_NOTES: t("student.dossierDetail.docs.labels.RELEVE_NOTES"),
    PHOTO: t("student.dossierDetail.docs.labels.PHOTO"),
    AUTRE: t("student.dossierDetail.docs.labels.AUTRE"),
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#070e20", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "36px", height: "36px", borderRadius: "50%", border: "2px solid rgba(245,200,66,0.2)", borderTopColor: "#f5c842", animation: "spin 0.8s linear infinite" }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (fetchError || !dossier) return (
    <div style={{ minHeight: "100vh", background: "#070e20", display: "flex", alignItems: "center", justifyContent: "center", padding: 36 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "40px", marginBottom: "16px" }}>📂</div>
        <h2 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: "20px", color: "#f8fafc", margin: "0 0 10px" }}>
          {t("student.dossierDetail.notFound")}
        </h2>
        <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "24px" }}>
          {t("student.dossierDetail.notFoundDesc")}
        </p>
        <button onClick={() => router.push("/student/dashboard")} style={{ padding: "11px 24px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#f5c842,#e8a820)", color: "#060d1f", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          {t("student.dossierDetail.backBtn")}
        </button>
      </div>
    </div>
  )

  const cfg       = STATUT_CFG[dossier.statut] ?? STATUT_CFG.BROUILLON
  const analyse   = dossier.analyses?.[0] ?? null
  const currentIdx = STEPS.indexOf(dossier.statut)
  const isRejected = dossier.statut === "REJETE"

  const cardStyle: React.CSSProperties = {
    padding: "28px 32px", borderRadius: "20px",
    background: "rgba(10,20,42,0.65)",
    border: "1px solid rgba(255,255,255,0.07)",
    marginBottom: "20px",
  }

  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "32px 36px" }}>
      {preview && <DocumentPreviewModal url={preview.url} nom={preview.nom} type={preview.type} onClose={() => setPreview(null)} />}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } } @media (max-width:768px) { .grid-2col { grid-template-columns:1fr!important; } }`}</style>

      <Link href="/student/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#64748b", fontSize: "13px", textDecoration: "none", marginBottom: "20px" }}>
        {t("student.dossierDetail.backToDashboard")}
      </Link>

      {/* Success banner */}
      {justSubmitted && (
        <div style={{ padding: "18px 24px", borderRadius: "16px", marginBottom: "28px", background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.18)", display: "flex", alignItems: "flex-start", gap: "14px", animation: "fadeUp 0.5s ease both" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#4ade80", marginBottom: "4px" }}>
              {t("student.dossierDetail.submitted.title")}
            </div>
            <div style={{ fontSize: "12.5px", color: "#64748b", lineHeight: 1.6 }}>
              {t("student.dossierDetail.submitted.desc")}
            </div>
          </div>
        </div>
      )}

      {/* AI analysis loading overlay — shown for ~3s after submission */}
      {analysisLoading && (
        <div style={{ padding: "22px 26px", borderRadius: "16px", marginBottom: "24px", background: "rgba(245,200,66,0.06)", border: "1px solid rgba(245,200,66,0.2)", display: "flex", alignItems: "center", gap: "16px", animation: "fadeUp 0.4s ease both" }}>
          <div style={{ position: "relative", width: "44px", height: "44px", flexShrink: 0 }}>
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none" style={{ position: "absolute", inset: 0 }}>
              <circle cx="22" cy="22" r="18" stroke="rgba(245,200,66,0.15)" strokeWidth="3"/>
              <circle cx="22" cy="22" r="18" stroke="#f5c842" strokeWidth="3" strokeLinecap="round" strokeDasharray="28 85" style={{ animation: "spin 1.2s linear infinite", transformOrigin:"center" }}/>
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>🤖</div>
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#f5c842", marginBottom: "4px" }}>Analyse IA en cours…</div>
            <div style={{ fontSize: "12px", color: "#64748b" }}>Évaluation de votre profil et recommandations de filières</div>
            <div style={{ display: "flex", gap: "4px", marginTop: "8px" }}>
              {["Chargement des données","Calcul du score","Sélection des filières"].map((step, i) => (
                <div key={step} style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "20px", background: "rgba(245,200,66,0.08)", color: "#f5c842", border: "1px solid rgba(245,200,66,0.2)", animation: `fadeIn 0.4s ease ${i*0.6}s both` }}>{step}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "26px", fontWeight: 600, color: "#f8fafc", margin: "0 0 6px" }}>
            {dossier.filiere?.nom ?? t("student.dossierDetail.filiereNotSelected")}
          </h1>
          <p style={{ fontSize: "13px", color: "#475569" }}>
            {new Date(dossier.dateCreation).toLocaleDateString(locale === "ar" ? "ar-TN" : locale === "en" ? "en-GB" : "fr-FR")} · {new Date(dossier.dateMaj).toLocaleDateString(locale === "ar" ? "ar-TN" : locale === "en" ? "en-GB" : "fr-FR")}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <div style={{ padding: "6px 16px", borderRadius: "20px", background: cfg.bg, border: `1px solid ${cfg.color}40`, color: cfg.color, fontSize: "13px", fontWeight: 600 }}>
            {cfg.label}
          </div>
          {dossier.statut === "VALIDE" && dossier.filiere && (
            <button
              onClick={() => void downloadAcceptanceLetter({
                dossierId: dossier.id,
                dateMaj:   dossier.dateMaj,
                etudiant:  dossier.etudiant,
                filiere:   dossier.filiere!,
              }, locale)}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "10px", border: "1px solid rgba(74,222,128,0.35)", background: "rgba(74,222,128,0.09)", color: "#4ade80", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
              title={t("student.dossierDetail.acceptanceLetter")}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>
              </svg>
              {t("student.dossierDetail.acceptanceLetter")}
            </button>
          )}
          <button
            onClick={() => void downloadDossierPDF(dossier, locale)}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "10px", border: "1px solid rgba(245,200,66,0.25)", background: "rgba(245,200,66,0.07)", color: "#f5c842", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
            title={t("common.downloadPDF")}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/>
            </svg>
            PDF
          </button>
        </div>
      </div>

      {/* Status timeline */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#64748b", marginBottom: "24px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          {t("student.dossierDetail.progress")}
        </h2>
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          {STEPS.map((s, i) => {
            const done   = !isRejected && i < currentIdx
            const active = !isRejected && i === currentIdx
            const sc     = STATUT_CFG[s]
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : 0 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, background: done ? "linear-gradient(135deg, #f5c842, #e8a820)" : active ? sc.bg : "rgba(255,255,255,0.04)", border: done ? "none" : active ? `2px solid ${sc.color}` : "1px solid rgba(255,255,255,0.08)", color: done ? "#060d1f" : active ? sc.color : "#334155", boxShadow: active ? `0 0 20px ${sc.color}30` : "none" }}>
                    {done ? "✓" : i + 1}
                  </div>
                  <span style={{ fontSize: "11px", color: done ? "#f5c842" : active ? sc.color : "#334155", fontWeight: active || done ? 600 : 400, whiteSpace: "nowrap" }}>
                    {sc.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: "2px", margin: "0 6px 28px", background: done ? "linear-gradient(90deg, #f5c842, rgba(245,200,66,0.3))" : "rgba(255,255,255,0.06)" }}/>
                )}
              </div>
            )
          })}
        </div>
        {/* Dated event timeline */}
        {(() => {
          const fmtDate = (d: string) => new Date(d).toLocaleDateString(
            locale === "ar" ? "ar-TN" : locale === "en" ? "en-GB" : "fr-FR",
            { day: "numeric", month: "long", year: "numeric" }
          )
          const events: { label: string; date: string; color: string }[] = [
            { label: t("statut.BROUILLON.label"), date: fmtDate(dossier.dateCreation), color: "#94a3b8" },
          ]
          if (dossier.statut !== "BROUILLON") {
            events.push({ label: STATUT_CFG[dossier.statut]?.label ?? dossier.statut, date: fmtDate(dossier.dateMaj), color: STATUT_CFG[dossier.statut]?.color ?? "#60a5fa" })
          }
          return (
            <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#334155", marginBottom: "12px" }}>
                {t("student.dossierDetail.timeline")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                {events.map((ev, i) => (
                  <div key={ev.label} style={{ display: "flex", gap: "12px", paddingBottom: i < events.length - 1 ? "12px" : 0 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                      <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: ev.color, flexShrink: 0, marginTop: "2px" }}/>
                      {i < events.length - 1 && <div style={{ width: "1px", flex: 1, background: "rgba(255,255,255,0.07)", marginTop: "4px" }}/>}
                    </div>
                    <div style={{ paddingBottom: i < events.length - 1 ? "4px" : 0 }}>
                      <div style={{ fontSize: "12.5px", fontWeight: 600, color: ev.color }}>{ev.label}</div>
                      <div style={{ fontSize: "11px", color: "#475569", marginTop: "1px" }}>{ev.date}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {isRejected && (
          <div style={{ marginTop: "20px", padding: "14px 18px", borderRadius: "12px", background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.18)", display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#f87171" strokeWidth={2} style={{ flexShrink: 0, marginTop: "1px" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>
            </svg>
            <div style={{ fontSize: "13px", color: "#fca5a5", lineHeight: 1.65 }}>
              {t("student.dossierDetail.rejectedNotice")}
            </div>
          </div>
        )}
      </div>

      <div className="grid-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* Documents */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, color: "#64748b", marginBottom: "20px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {t("student.dossierDetail.docs.title", { count: String(dossier.documents.length) })}
          </h2>
          {dossier.documents.length === 0 ? (
            <p style={{ color: "#334155", fontSize: "13px" }}>{t("student.dossierDetail.docs.none")}</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {dossier.documents.map((doc) => {
                const verifCfg = doc.verification === "VERIFIED"
                  ? { label:"Vérifié ✓", color:"#4ade80", bg:"rgba(74,222,128,0.08)", border:"rgba(74,222,128,0.2)" }
                  : doc.verification === "REJECTED"
                  ? { label:"Refusé — action requise ✗", color:"#f87171", bg:"rgba(248,113,113,0.08)", border:"rgba(248,113,113,0.25)" }
                  : doc.verification === "NEEDS_REUPLOAD"
                  ? { label:"Veuillez resoumettre ⚠", color:"#f5c842", bg:"rgba(245,200,66,0.07)", border:"rgba(245,200,66,0.22)" }
                  : null
                return (
                  <div key={doc.id} style={{ borderRadius:"10px", background: verifCfg ? verifCfg.bg : "rgba(255,255,255,0.04)", border:`1px solid ${verifCfg ? verifCfg.border : "rgba(255,255,255,0.06)"}`, overflow:"hidden" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px", minWidth:0, flex:1 }}>
                        <span style={{ padding:"3px 8px", borderRadius:"6px", fontSize:"10px", fontWeight:700, background:"rgba(245,200,66,0.1)", color:"#f5c842", flexShrink:0 }}>
                          {DOC_LABELS[doc.type] ?? doc.type}
                        </span>
                        {verifCfg && <span style={{ fontSize:"10px", fontWeight:700, color:verifCfg.color, flexShrink:0 }}>{verifCfg.label}</span>}
                      </div>
                      <button onClick={() => setPreview({ url: doc.url, nom: doc.nom, type: DOC_LABELS[doc.type] ?? doc.type })} style={{ fontSize:"12px", color:"#60a5fa", background:"none", border:"none", cursor:"pointer", flexShrink:0, marginLeft:"8px", fontFamily:"inherit", textDecoration:"underline" }}>
                        {t("student.dossierDetail.docs.view")}
                      </button>
                    </div>
                    {doc.verificationNote && (
                      <div style={{ padding:"6px 14px 10px", fontSize:"11px", color: doc.verification === "VERIFIED" ? "#4ade80" : doc.verification === "REJECTED" ? "#f87171" : "#f5c842" }}>
                        💬 {doc.verificationNote}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* AI Recommendations — hidden while analysis loading animation is running */}
        {!analysisLoading && analyse && analyse.filiereRecommandations.length > 0 && (
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(245,200,66,0.1)", border: "1px solid rgba(245,200,66,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#f5c842" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>
                </svg>
              </div>
              <div>
                <h2 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: "16px", fontWeight: 600, color: "#f8fafc", margin: 0 }}>
                  {t("student.dossierDetail.analysis.title")}
                </h2>
                <p style={{ fontSize: "11.5px", color: "#475569", margin: "2px 0 0" }}>
                  {new Date(analyse.dateAnalyse).toLocaleDateString(locale === "ar" ? "ar-TN" : locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
            </div>

            {analyse.resultat && (
              <div style={{ padding: "16px 20px", borderRadius: "12px", background: "rgba(245,200,66,0.04)", border: "1px solid rgba(245,200,66,0.12)", marginBottom: "20px" }}>
                <p style={{ fontSize: "13.5px", color: "#cbd5e1", lineHeight: 1.8, margin: 0, fontStyle: "italic" }}>
                  {analyse.resultat}
                </p>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {analyse.filiereRecommandations.sort((a, b) => a.rang - b.rang).map((rec, i) => {
                const isTop = rec.rang === 1
                const rankColors = ["#f5c842", "#94a3b8", "#8b6914"]
                const rankColor  = rankColors[i] ?? "#475569"
                return (
                  <div key={rec.filiere.id} style={{ padding: "16px 18px", borderRadius: "14px", background: isTop ? "rgba(245,200,66,0.07)" : "rgba(255,255,255,0.02)", border: isTop ? "1px solid rgba(245,200,66,0.22)" : "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: `rgba(${isTop ? "245,200,66" : "255,255,255"},0.06)`, border: `1px solid ${rankColor}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: rankColor }}>#{rec.rang}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "14px", fontWeight: isTop ? 700 : 500, color: isTop ? "#f5c842" : "#e2e8f0" }}>{rec.filiere.nom}</div>
                        {isTop && <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "3px" }}>{t("student.dossierDetail.analysis.bestMatch")}</div>}
                      </div>
                      {isTop && (
                        <div style={{ padding: "3px 10px", borderRadius: "20px", background: "rgba(245,200,66,0.12)", border: "1px solid rgba(245,200,66,0.25)", fontSize: "10px", fontWeight: 700, color: "#f5c842", letterSpacing: "0.06em", flexShrink: 0 }}>
                          {t("student.dossierDetail.analysis.recommended")}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {!analyse.complet && (
              <div style={{ marginTop: "16px", padding: "12px 16px", borderRadius: "10px", background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.18)", fontSize: "12.5px", color: "#fca5a5", lineHeight: 1.6 }}>
                {t("student.dossierDetail.analysis.incomplete")}
              </div>
            )}

            <p style={{ fontSize: "11px", color: "#334155", marginTop: "16px", marginBottom: 0, lineHeight: 1.6 }}>
              {t("student.dossierDetail.analysis.footer")}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

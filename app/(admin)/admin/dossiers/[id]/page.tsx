"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import ConfirmModal from "@/components/ConfirmModal"
import { useI18n } from "@/lib/i18n-context"
import { downloadDossierPDF } from "@/lib/generatePDF"
import DocumentPreviewModal from "@/components/DocumentPreviewModal"

interface Document {
  id: string; type: string; nom: string; url: string
  verification?: "VERIFIED" | "REJECTED" | "NEEDS_REUPLOAD" | null
  verificationNote?: string | null
}

const GRADE_LABELS: Record<string, string> = {
  math:"Mathématiques", physique:"Physique", svt:"Sciences naturelles",
  francais:"Français", arabe:"Arabe", anglais:"Anglais",
  informatique:"Informatique", histoire_geo:"Histoire-Géo",
  philosophie:"Philosophie", techno:"Technologie",
  economie:"Économie", gestion:"Gestion", sport:"Sport", sciences:"Sciences",
  moyenneGenerale:"Moyenne générale", moyennegenerale:"Moyenne générale",
}
interface FiliereRec { rang: number; filiere: { id: string; nom: string } }
interface Analyse { score: number; complet: boolean; resultat: string; filiereRecommandations: FiliereRec[] }
interface Dossier {
  id: string; statut: string; score: number | null; dateCreation: string; dateMaj: string
  etudiant: {
    id: string; nom: string | null; prenom: string | null; email: string
    dateNaissance: string | null; typeIdentite: string | null; numeroIdentite: string | null
    sexe: string | null; pays: string | null; telephone: string | null; adresse: string | null
  }
  filiere: { id: string; nom: string; capacite: number } | null
  niveauEtude: string | null; typeCours: string | null
  diplomeVise: string | null; sourceDecouverte: string | null
  notes: Record<string, number> | null
  diplomes: { id: string; intitule: string; annee: number; etablissement: string | null; type: string | null; sousType: string | null; champs: Record<string, unknown> | null }[]
  documents: Document[]
  analyses: Analyse[]
}

export default function AdminDossierDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const { t, locale } = useI18n()

  const [dossier, setDossier]       = useState<Dossier | null>(null)
  const [loading, setLoading]       = useState(true)
  const [preview, setPreview]       = useState<{ url: string; nom: string; type: string } | null>(null)
  const [actionLoading, setAction]  = useState<string | null>(null)
  const [error, setError]           = useState("")
  const [success, setSuccess]       = useState("")
  const [pendingAction, setPending] = useState<{ statut: string; label: string; variant: "success" | "danger" | "warning" } | null>(null)
  const [motifRejet, setMotifRejet] = useState("")
  const [staleAnalysis, setStaleAnalysis] = useState(false)

  const STATUT_CFG: Record<string, { label: string; color: string; bg: string }> = {
    BROUILLON:  { label: t("statut.BROUILLON.label"), color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
    SOUMIS:     { label: t("statut.SOUMIS.label"),     color: "#60a5fa", bg: "rgba(96,165,250,0.12)"  },
    EN_ANALYSE: { label: t("statut.EN_ANALYSE.label"), color: "#f5c842", bg: "rgba(245,200,66,0.12)"  },
    VALIDE:     { label: t("statut.VALIDE.label"),     color: "#4ade80", bg: "rgba(74,222,128,0.12)"  },
    REJETE:     { label: t("statut.REJETE.label"),     color: "#f87171", bg: "rgba(248,113,113,0.12)" },
  }

  const DOC_LABELS: Record<string, string> = {
    CNI: t("admin.dossierDetail.docs.labels.CNI"), DIPLOME: t("admin.dossierDetail.docs.labels.DIPLOME"),
    RELEVE_NOTES: t("admin.dossierDetail.docs.labels.RELEVE_NOTES"), PHOTO: t("admin.dossierDetail.docs.labels.PHOTO"), AUTRE: t("admin.dossierDetail.docs.labels.AUTRE"),
  }

  const ADMIN_ACTIONS: Record<string, { label: string; statut: string; color: string; bg: string }[]> = {
    SOUMIS:        [{ label: t("admin.dossierDetail.decision.actions.EN_ANALYSE"), statut: "EN_ANALYSE", color: "#f5c842", bg: "rgba(245,200,66,0.15)" }, { label: t("admin.dossierDetail.decision.actions.REJETE"), statut: "REJETE", color: "#f87171", bg: "rgba(248,113,113,0.12)" }],
    EN_ANALYSE:    [{ label: t("admin.dossierDetail.decision.actions.VALIDE"),    statut: "VALIDE",     color: "#4ade80", bg: "rgba(74,222,128,0.15)"  }, { label: t("admin.dossierDetail.decision.actions.REJETE"), statut: "REJETE", color: "#f87171", bg: "rgba(248,113,113,0.12)" }],
    VALIDE:        [{ label: t("admin.dossierDetail.decision.actions.BROUILLON"), statut: "BROUILLON",  color: "#94a3b8", bg: "rgba(148,163,184,0.12)" }],
    LISTE_ATTENTE: [{ label: t("admin.dossierDetail.decision.actions.EN_ANALYSE"), statut: "EN_ANALYSE", color: "#f5c842", bg: "rgba(245,200,66,0.15)" }],
  }

  useEffect(() => {
    fetch(`/api/dossiers/${id}`).then((r) => r.json()).then((d) => setDossier(d.dossier)).finally(() => setLoading(false))
  }, [id])

  async function runAnalysis() {
    setAction("analyse"); setError("")
    try {
      await fetch(`/api/dossiers/${id}/analyse`, { method: "POST" })
      const fresh = await fetch(`/api/dossiers/${id}`).then((r) => r.json())
      setDossier(fresh.dossier)
      setSuccess(t("admin.dossierDetail.ai.analysedAt", { time: new Date().toLocaleTimeString(locale === "ar" ? "ar-TN" : locale === "en" ? "en-GB" : "fr-FR"), score: String(fresh.dossier?.score ?? "—") }))
    } catch (e: unknown) { setError(e instanceof Error ? e.message : t("common.error")) }
    finally { setAction(null) }
  }

  async function transition(statut: string) {
    setAction(statut); setError(""); setSuccess("")
    try {
      const res = await fetch(`/api/dossiers/${id}/statut`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut, motifRejet: statut === "REJETE" ? motifRejet : undefined }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? t("common.error")) }
      const fresh = await fetch(`/api/dossiers/${id}`).then((r) => r.json())
      setDossier(fresh.dossier)
      setSuccess(`${STATUT_CFG[statut]?.label}`)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : t("common.error")) }
    finally { setAction(null); setPending(null); setMotifRejet("") }
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#070e20", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "36px", height: "36px", borderRadius: "50%", border: "2px solid rgba(245,200,66,0.2)", borderTopColor: "#f5c842", animation: "spin 0.8s linear infinite" }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (!dossier) return (
    <div style={{ minHeight: "100vh", background: "#070e20", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#475569" }}>{t("admin.dossierDetail.notFound")}</p>
    </div>
  )

  const cfg      = STATUT_CFG[dossier.statut] ?? STATUT_CFG.SOUMIS
  const analyse  = dossier.analyses?.[0] ?? null
  const actions  = ADMIN_ACTIONS[dossier.statut] ?? []
  const fullName = [dossier.etudiant.prenom, dossier.etudiant.nom].filter(Boolean).join(" ") || dossier.etudiant.email

  const niveauLabel = (v: string | null) => v ? (({ BACCALAUREAT: t("admin.dossierDetail.labels.niveau.BACCALAUREAT"), LICENCE_1: t("admin.dossierDetail.labels.niveau.LICENCE_1"), LICENCE_2: t("admin.dossierDetail.labels.niveau.LICENCE_2"), LICENCE_3: t("admin.dossierDetail.labels.niveau.LICENCE_3"), MASTER_1: t("admin.dossierDetail.labels.niveau.MASTER_1"), MASTER_2: t("admin.dossierDetail.labels.niveau.MASTER_2"), DOCTORAT: t("admin.dossierDetail.labels.niveau.DOCTORAT"), AUTRE: t("admin.dossierDetail.labels.niveau.AUTRE") })[v] ?? v) : "—"
  const coursLabel  = (v: string | null) => v ? (({ COURS_JOUR: t("admin.dossierDetail.labels.cours.COURS_JOUR"), COURS_SOIR: t("admin.dossierDetail.labels.cours.COURS_SOIR"), FORMATION_CONTINUE: t("admin.dossierDetail.labels.cours.FORMATION_CONTINUE") })[v] ?? v) : "—"
  const sexeLabel   = (v: string | null) => v ? (({ HOMME: t("admin.dossierDetail.labels.sexe.HOMME"), FEMME: t("admin.dossierDetail.labels.sexe.FEMME"), AUTRE: t("admin.dossierDetail.labels.sexe.AUTRE") })[v] ?? v) : "—"
  const sourceLabel = (v: string | null) => v ? (({ AMIS: t("admin.dossierDetail.labels.source.AMIS"), RESEAUX_SOCIAUX: t("admin.dossierDetail.labels.source.RESEAUX_SOCIAUX"), SITE_WEB: t("admin.dossierDetail.labels.source.SITE_WEB"), PUBLICITE: t("admin.dossierDetail.labels.source.PUBLICITE"), SALON_ETUDIANT: t("admin.dossierDetail.labels.source.SALON_ETUDIANT"), AUTRE: t("admin.dossierDetail.labels.source.AUTRE") })[v] ?? v) : "—"
  const identiteLabel = (v: string | null) => v ? (({ CIN: t("admin.dossierDetail.labels.identite.CIN"), PASSEPORT: t("admin.dossierDetail.labels.identite.PASSEPORT") })[v] ?? v) : t("admin.dossierDetail.fields.typeIdentite")

  const cardStyle: React.CSSProperties = { padding: "24px 28px", borderRadius: "18px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: "20px" }

  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "32px 36px" }}>
      {preview && <DocumentPreviewModal url={preview.url} nom={preview.nom} type={preview.type} onClose={() => setPreview(null)} />}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }`}</style>

      <Link href="/admin/dossiers" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#64748b", fontSize: "13px", textDecoration: "none", marginBottom: "20px" }}>
        {t("admin.dossierDetail.back")}
      </Link>

      {error   && <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.28)", fontSize: "13px", color: "#fca5a5" }}>{error}</div>}
      {success && <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "12px", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", fontSize: "13px", color: "#4ade80" }}>{success}</div>}
      {staleAnalysis && (
        <div style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "12px", background: "rgba(245,200,66,0.07)", border: "1px solid rgba(245,200,66,0.28)", fontSize: "13px", color: "#f5c842", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <span>⚠ Les notes ont été modifiées — l'analyse IA est peut-être obsolète.</span>
          <button
            onClick={() => { setStaleAnalysis(false); void runAnalysis() }}
            disabled={!!actionLoading}
            style={{ padding: "5px 14px", borderRadius: "8px", border: "1px solid rgba(245,200,66,0.4)", background: "rgba(245,200,66,0.12)", color: "#f5c842", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
          >
            Relancer l'analyse
          </button>
          <button onClick={() => setStaleAnalysis(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "16px", flexShrink: 0 }}>✕</button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "26px", fontWeight: 600, color: "#f8fafc", margin: "0 0 6px" }}>{fullName}</h1>
          <p style={{ fontSize: "13px", color: "#475569" }}>
            {dossier.filiere?.nom ?? t("admin.dossierDetail.fields.filiereNotSelected")} · {dossier.documents.length} document{dossier.documents.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ padding: "6px 16px", borderRadius: "20px", background: cfg.bg, color: cfg.color, fontSize: "13px", fontWeight: 600 }}>{cfg.label}</span>
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

      <div className="grid-detail" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "20px" }}>
        <div>
          {/* Identity */}
          <div style={cardStyle}>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "16px", fontWeight: 500, color: "#f8fafc", margin: "0 0 18px" }}>
              {t("admin.dossierDetail.identity")}
            </h2>
            {(() => {
              const photoDoc = dossier.documents.find((d) => d.type === "PHOTO")
              return photoDoc ? (
                <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", marginBottom: "16px" }}>
                  <div style={{ flexShrink: 0 }}>
                    <img src={photoDoc.url} alt="Photo" style={{ width: "88px", height: "110px", objectFit: "cover", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", display: "block" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}/>
                    <div style={{ fontSize: "9.5px", color: "#334155", textAlign: "center", marginTop: "4px" }}>{t("admin.dossierDetail.docs.labels.PHOTO")}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: "20px", fontWeight: 600, color: "#f8fafc", marginBottom: "4px" }}>{fullName}</div>
                    <div style={{ fontSize: "12px", color: "#475569" }}>{dossier.etudiant.email}</div>
                  </div>
                </div>
              ) : null
            })()}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {[
                { label: t("admin.dossierDetail.fields.fullName"),       value: fullName },
                { label: t("admin.dossierDetail.fields.email"),          value: dossier.etudiant.email },
                { label: t("admin.dossierDetail.fields.dateNaissance"),  value: dossier.etudiant.dateNaissance ? new Date(dossier.etudiant.dateNaissance).toLocaleDateString(locale === "ar" ? "ar-TN" : locale === "en" ? "en-GB" : "fr-FR") : "—" },
                { label: t("admin.dossierDetail.fields.sexe"),           value: sexeLabel(dossier.etudiant.sexe) },
                { label: identiteLabel(dossier.etudiant.typeIdentite),   value: dossier.etudiant.numeroIdentite ?? "—" },
                { label: t("admin.dossierDetail.fields.pays"),           value: dossier.etudiant.pays ?? "—" },
                { label: t("admin.dossierDetail.fields.telephone"),      value: dossier.etudiant.telephone ?? "—" },
                { label: t("admin.dossierDetail.fields.adresse"),        value: dossier.etudiant.adresse ?? "—" },
              ].map(({ label, value }) => (
                <InfoField key={label} label={label} value={value} wide={label === t("admin.dossierDetail.fields.adresse")} />
              ))}
            </div>
          </div>

          {/* Academic */}
          <div style={cardStyle}>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "16px", fontWeight: 500, color: "#f8fafc", margin: "0 0 18px" }}>
              {t("admin.dossierDetail.academic")}
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {[
                { label: t("admin.dossierDetail.fields.niveauActuel"),    value: niveauLabel(dossier.niveauEtude) },
                { label: t("admin.dossierDetail.fields.typeCours"),       value: coursLabel(dossier.typeCours) },
                { label: t("admin.dossierDetail.fields.filiereChoisie"),  value: dossier.filiere?.nom ?? "—" },
                { label: t("admin.dossierDetail.fields.sourceDecouverte"), value: sourceLabel(dossier.sourceDecouverte) },
                { label: t("admin.dossierDetail.fields.dateSoumission"),  value: new Date(dossier.dateCreation).toLocaleDateString(locale === "ar" ? "ar-TN" : locale === "en" ? "en-GB" : "fr-FR") },
              ].map(({ label, value }) => (
                <InfoField key={label} label={label} value={value} />
              ))}
            </div>
            {/* Diplomas list */}
            {(dossier.diplomes?.length ?? 0) > 0 && (
              <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#475569", marginBottom: "10px" }}>
                  {t("admin.dossierDetail.fields.diplomes")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {dossier.diplomes.map((d) => (
                    <div key={d.id} style={{ display: "flex", alignItems: "baseline", gap: "10px", padding: "7px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#f8fafc", flex: 1 }}>{d.intitule}</span>
                      <span style={{ fontSize: "12px", color: "#f5c842", fontWeight: 600, flexShrink: 0 }}>{d.annee}</span>
                      {d.etablissement && <span style={{ fontSize: "11px", color: "#475569", flexShrink: 0 }}>{d.etablissement}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {dossier.notes && Object.keys(dossier.notes as object).length > 0 && (
              <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#475569", marginBottom: "10px" }}>
                  {t("admin.dossierDetail.notesLabel")}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {Object.entries(dossier.notes as Record<string, number>)
                    .filter(([k]) => !k.startsWith("__") && /^[a-z_]+$/i.test(k))
                    .map(([key, val]) => (
                    <div key={key} style={{ padding: "5px 11px", borderRadius: "8px", background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.15)", fontSize: "12px" }}>
                      <span style={{ color: "#64748b" }}>{GRADE_LABELS[key] ?? GRADE_LABELS[key.toLowerCase()] ?? key.replace(/_/g, " ")}</span>
                      <span style={{ color: "#f5c842", fontWeight: 700, marginLeft: "6px" }}>{val}/20</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Documents */}
          <div style={cardStyle}>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "16px", fontWeight: 500, color: "#f8fafc", margin: "0 0 18px" }}>
              {t("admin.dossierDetail.docs.title", { count: String(dossier.documents.length) })}
            </h2>
            {dossier.documents.length === 0 ? (
              <p style={{ color: "#334155", fontSize: "13px" }}>{t("admin.dossierDetail.docs.none")}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {dossier.documents.map((doc) => (
                  <DocVerifyRow
                    key={doc.id} doc={doc} dossierId={dossier.id}
                    onPreview={() => setPreview({ url: doc.url, nom: doc.nom, type: DOC_LABELS[doc.type] ?? doc.type })}
                    onUpdated={(updated) => setDossier(d => d ? { ...d, documents: d.documents.map(x => x.id === updated.id ? { ...x, ...updated } : x) } : d)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* AI Analysis */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "16px", fontWeight: 500, color: "#f8fafc", margin: 0 }}>
                {t("admin.dossierDetail.ai.title")}
              </h2>
              <button onClick={runAnalysis} disabled={!!actionLoading} style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.08)", color: "#60a5fa", fontSize: "12px", fontWeight: 600, cursor: actionLoading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {actionLoading === "analyse" ? t("admin.dossierDetail.ai.running") : t("admin.dossierDetail.ai.rerun")}
              </button>
            </div>
            {!analyse ? (
              <p style={{ color: "#334155", fontSize: "13px" }}>{t("admin.dossierDetail.ai.none")}</p>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px", color: "#94a3b8" }}>{t("admin.dossierDetail.ai.score")}</span>
                  <span style={{ fontSize: "22px", fontWeight: 700, color: analyse.score >= 70 ? "#4ade80" : analyse.score >= 40 ? "#f5c842" : "#f87171" }}>
                    {Math.round(analyse.score)}<span style={{ fontSize: "12px", color: "#475569" }}>/100</span>
                  </span>
                </div>
                <div style={{ height: "6px", borderRadius: "6px", background: "rgba(255,255,255,0.07)", overflow: "hidden", marginBottom: "16px" }}>
                  <div style={{ width: `${analyse.score}%`, height: "100%", borderRadius: "6px", background: analyse.score >= 70 ? "linear-gradient(90deg,#4ade80,#22c55e)" : analyse.score >= 40 ? "linear-gradient(90deg,#f5c842,#e8a820)" : "linear-gradient(90deg,#f87171,#ef4444)" }}/>
                </div>
                <div style={{ padding: "10px 14px", borderRadius: "10px", marginBottom: "14px", background: analyse.complet ? "rgba(74,222,128,0.08)" : "rgba(248,113,113,0.08)", border: analyse.complet ? "1px solid rgba(74,222,128,0.2)" : "1px solid rgba(248,113,113,0.2)", fontSize: "12px", color: analyse.complet ? "#4ade80" : "#f87171" }}>
                  {analyse.complet ? t("admin.dossierDetail.ai.complete") : t("admin.dossierDetail.ai.incomplete")}
                </div>
                <p style={{ fontSize: "12px", color: "#64748b", lineHeight: 1.7, margin: "0 0 4px", fontStyle: "italic" }}>
                  {analyse.resultat}
                </p>
                {analyse.filiereRecommandations.length > 0 && (
                  <div style={{ marginTop: "14px" }}>
                    <div style={{ fontSize: "11px", color: "#475569", fontWeight: 600, marginBottom: "8px", letterSpacing: "0.08em", textTransform: "uppercase" }}>{t("admin.dossierDetail.ai.recommendations")}</div>
                    {analyse.filiereRecommandations.map((r) => (
                      <div key={r.filiere.id} style={{ padding: "7px 12px", borderRadius: "8px", marginBottom: "6px", background: r.rang === 1 ? "rgba(245,200,66,0.08)" : "rgba(255,255,255,0.03)", border: r.rang === 1 ? "1px solid rgba(245,200,66,0.2)" : "1px solid rgba(255,255,255,0.06)", fontSize: "12px", color: r.rang === 1 ? "#f5c842" : "#94a3b8" }}>
                        {r.rang > 1 && <span style={{ marginRight: "4px", color: "#475569" }}>{r.rang}.</span>}{r.filiere.nom}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Internal notes — shown prominently before audit log */}
          <NotesPanel dossierId={id} t={t} locale={locale} highlighted />

          {/* Audit log */}
          <AuditPanel dossierId={id} t={t} locale={locale} />
        </div>

        {/* Action panel */}
        <div style={{ position: "sticky", top: "24px", alignSelf: "flex-start" }}>
          <div style={{ padding: "24px", borderRadius: "18px", background: "rgba(10,20,42,0.8)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "16px", fontWeight: 500, color: "#f8fafc", margin: "0 0 20px" }}>
              {t("admin.dossierDetail.decision.title")}
            </h2>

            {actions.length === 0 ? (
              <div style={{ padding: "14px", borderRadius: "10px", background: cfg.bg, border: `1px solid ${cfg.color}30`, textAlign: "center" }}>
                <div style={{ fontSize: "13px", color: cfg.color, fontWeight: 600, marginBottom: "4px" }}>{cfg.label}</div>
                <div style={{ fontSize: "11px", color: "#475569" }}>{t("admin.dossierDetail.decision.noAction")}</div>
              </div>
            ) : pendingAction?.statut === "REJETE" ? (
              <div style={{ animation: "fadeIn 0.2s ease both" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#f87171", marginBottom: "10px" }}>
                  {t("admin.dossierDetail.decision.rejectReason")}
                </div>
                <textarea value={motifRejet} onChange={(e) => setMotifRejet(e.target.value)}
                  placeholder={t("admin.dossierDetail.decision.rejectPlaceholder")}
                  rows={4}
                  style={{ width: "100%", padding: "11px 13px", borderRadius: "10px", background: "rgba(255,255,255,0.05)", border: motifRejet.trim() ? "1px solid rgba(248,113,113,0.35)" : "1px solid rgba(255,255,255,0.1)", color: "#f8fafc", fontSize: "12.5px", outline: "none", fontFamily: "inherit", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" }}
                  autoFocus/>
                <div style={{ fontSize: "11px", color: "#475569", marginTop: "6px", marginBottom: "14px" }}>
                  {t("admin.dossierDetail.decision.charCount", { count: String(motifRejet.trim().length) })}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => { setPending(null); setMotifRejet("") }} style={{ flex: 1, padding: "10px", borderRadius: "9px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#64748b", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}>
                    {t("common.cancel")}
                  </button>
                  <button onClick={() => motifRejet.trim() && transition("REJETE")} disabled={!motifRejet.trim() || !!actionLoading} style={{ flex: 1, padding: "10px", borderRadius: "9px", border: "none", background: motifRejet.trim() && !actionLoading ? "linear-gradient(135deg,#f87171,#ef4444)" : "rgba(248,113,113,0.25)", color: motifRejet.trim() ? "#fff" : "#64748b", fontSize: "12px", fontWeight: 700, cursor: motifRejet.trim() && !actionLoading ? "pointer" : "not-allowed", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                    {actionLoading === "REJETE" ? (
                      <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.8s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>{t("admin.dossierDetail.decision.rejecting")}</>
                    ) : t("admin.dossierDetail.decision.confirmReject")}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {actions.map((action) => (
                  <button key={action.statut} onClick={() => setPending({ statut: action.statut, label: action.label, variant: action.statut === "VALIDE" ? "success" : action.statut === "REJETE" ? "danger" : action.statut === "BROUILLON" ? "danger" : "warning" })} disabled={!!actionLoading} style={{ width: "100%", padding: "13px 18px", borderRadius: "12px", border: `1px solid ${action.color}30`, background: action.bg, color: action.color, fontSize: "13px", fontWeight: 700, cursor: actionLoading ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                    {action.label}
                  </button>
                ))}
              </div>
            )}

            <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", gap: "8px" }}>
              {[
                { label: t("admin.dossierDetail.fields.creeLe"),    value: new Date(dossier.dateCreation).toLocaleDateString(locale === "ar" ? "ar-TN" : locale === "en" ? "en-GB" : "fr-FR") },
                { label: t("admin.dossierDetail.fields.modifieLe"), value: new Date(dossier.dateMaj).toLocaleDateString(locale === "ar" ? "ar-TN" : locale === "en" ? "en-GB" : "fr-FR") },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <span style={{ color: "#475569" }}>{label}</span>
                  <span style={{ color: "#94a3b8" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Admin quick-edit panel */}
          <AdminEditPanel dossier={dossier} t={t} onSaved={(updated) => setDossier(updated as typeof dossier)} onGradesChanged={() => setStaleAnalysis(true)} />

          {/* Message to student */}
          <MessagePanel dossierId={dossier.id} />
        </div>
      </div>

      <ConfirmModal
        open={!!pendingAction && pendingAction.statut !== "REJETE"}
        title={
          pendingAction?.statut === "VALIDE"    ? t("admin.dossierDetail.decision.confirmValidate.title") :
          pendingAction?.statut === "BROUILLON" ? t("admin.dossierDetail.decision.confirmRevoke.title") :
          t("admin.dossierDetail.decision.confirmAnalyse.title")
        }
        message={
          pendingAction?.statut === "VALIDE"    ? t("admin.dossierDetail.decision.confirmValidate.message") :
          pendingAction?.statut === "BROUILLON" ? t("admin.dossierDetail.decision.confirmRevoke.message") :
          t("admin.dossierDetail.decision.confirmAnalyse.message")
        }
        confirmLabel={pendingAction?.label ?? t("common.confirm")}
        cancelLabel={t("common.cancel")}
        variant={pendingAction?.variant ?? "warning"}
        loading={!!actionLoading}
        onConfirm={() => pendingAction && transition(pendingAction.statut)}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}

// ── Internal notes panel ──────────────────────────────────────────────────────

// ── Admin full-edit modal ─────────────────────────────────────────────────────

function AdminEditPanel({ dossier, t, onSaved, onGradesChanged }: {
  dossier: Dossier
  t: (k: string, v?: Record<string, string | number>) => string
  onSaved: (updated: Dossier) => void
  onGradesChanged: () => void
}) {
  const [open,   setOpen]   = useState(false)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState("")
  const [filieres, setFilieres] = useState<{ id: string; nom: string }[]>([])

  // ── Student profile ───────────────────────────────────────────────────────
  const [nom,            setNom]            = useState(dossier.etudiant.nom ?? "")
  const [prenom,         setPrenom]         = useState(dossier.etudiant.prenom ?? "")
  const [email,          setEmail]          = useState(dossier.etudiant.email ?? "")
  const [dateNaissance,  setDateNaissance]  = useState(dossier.etudiant.dateNaissance?.slice(0,10) ?? "")
  const [typeIdentite,   setTypeIdentite]   = useState(dossier.etudiant.typeIdentite ?? "")
  const [numeroIdentite, setNumeroIdentite] = useState(dossier.etudiant.numeroIdentite ?? "")
  const [telephone,      setTelephone]      = useState(dossier.etudiant.telephone ?? "")
  const [adresse,        setAdresse]        = useState(dossier.etudiant.adresse ?? "")
  const [pays,           setPays]           = useState(dossier.etudiant.pays ?? "")

  // ── Academic background ───────────────────────────────────────────────────
  const [niveauEtude,      setNiveauEtude]      = useState(dossier.niveauEtude ?? "")
  const [typeCours,        setTypeCours]        = useState(dossier.typeCours ?? "")
  const [sourceDecouverte, setSourceDecouverte] = useState(dossier.sourceDecouverte ?? "")

  // ── Diplomas ──────────────────────────────────────────────────────────────
  type DiploEdit = { intitule: string; annee: string; etablissement: string; type: string; sousType: string; champs: Record<string,string> }
  const initDiplomes = useCallback(() =>
    dossier.diplomes.map(d => ({
      intitule:      d.intitule,
      annee:         String(d.annee),
      etablissement: d.etablissement ?? "",
      type:          d.type ?? "",
      sousType:      d.sousType ?? "",
      champs:        Object.fromEntries(Object.entries(d.champs ?? {}).map(([k,v])=>[k,String(v)])),
    })), [dossier.diplomes])
  const [diplomes, setDiplomes] = useState<DiploEdit[]>(initDiplomes)

  // ── Filière ───────────────────────────────────────────────────────────────
  const [filiereId, setFiliereId] = useState(dossier.filiere?.id ?? "")

  // ── Document upload ───────────────────────────────────────────────────────
  const [uploadFile, setUploadFile] = useState<File|null>(null)
  const [uploadType, setUploadType] = useState("DIPLOME")
  const [uploading,  setUploading]  = useState(false)
  const [uploadDone, setUploadDone] = useState(false)

  useEffect(() => {
    if (open && filieres.length === 0)
      fetch("/api/filieres").then(r=>r.json()).then(d=>setFilieres(d.filieres ?? []))
  }, [open, filieres.length])

  // Reset state when dossier changes
  useEffect(() => {
    setNom(dossier.etudiant.nom ?? ""); setPrenom(dossier.etudiant.prenom ?? "")
    setEmail(dossier.etudiant.email ?? ""); setDateNaissance(dossier.etudiant.dateNaissance?.slice(0,10) ?? "")
    setTypeIdentite(dossier.etudiant.typeIdentite ?? ""); setNumeroIdentite(dossier.etudiant.numeroIdentite ?? "")
    setTelephone(dossier.etudiant.telephone ?? ""); setAdresse(dossier.etudiant.adresse ?? ""); setPays(dossier.etudiant.pays ?? "")
    setNiveauEtude(dossier.niveauEtude ?? ""); setTypeCours(dossier.typeCours ?? ""); setSourceDecouverte(dossier.sourceDecouverte ?? "")
    setFiliereId(dossier.filiere?.id ?? ""); setDiplomes(initDiplomes())
  }, [dossier, initDiplomes])

  function updDiplo(i: number, patch: Partial<DiploEdit>) {
    setDiplomes(p => { const n=[...p]; n[i]={...n[i],...patch}; return n })
  }

  async function handleSave() {
    setSaving(true); setError("")
    try {
      const notes: Record<string,number> = {}
      for (const d of diplomes)
        for (const [k,v] of Object.entries(d.champs)) {
          const n=parseFloat(v); if (!isNaN(n)&&n>=0&&n<=20) notes[k]=n
        }

      // Detect if grades changed vs existing dossier.notes
      const existingNotes = (dossier.notes ?? {}) as Record<string, number>
      const notesChanged = JSON.stringify(
        Object.fromEntries(Object.entries(notes).sort())
      ) !== JSON.stringify(
        Object.fromEntries(Object.entries(existingNotes).sort())
      )

      const res = await fetch(`/api/dossiers/${dossier.id}`, {
        method: "PUT", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          filiereId:        filiereId || null,
          niveauEtude:      niveauEtude || null,
          typeCours:        typeCours || null,
          sourceDecouverte: sourceDecouverte || null,
          notes:            Object.keys(notes).length > 0 ? notes : null,
          diplomes:         diplomes.filter(d=>d.type||d.annee).map(d=>({
            intitule:      d.intitule.trim() || d.type || "",
            annee:         parseInt(d.annee) || new Date().getFullYear(),
            etablissement: d.etablissement.trim() || undefined,
            type:          d.type || undefined,
            sousType:      d.sousType || undefined,
            champs:        Object.keys(d.champs).length > 0 ? d.champs : undefined,
          })),
          etudiant: { nom, prenom, email, dateNaissance: dateNaissance || null, typeIdentite: typeIdentite || null, numeroIdentite: numeroIdentite || null, telephone: telephone || null, adresse: adresse || null, pays: pays || null },
        }),
      })
      if (!res.ok) { const d=await res.json(); throw new Error(d.error ?? t("common.error")) }
      const data = await res.json()
      onSaved(data.dossier)
      setOpen(false)
      if (notesChanged) onGradesChanged()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : t("common.error")) }
    finally { setSaving(false) }
  }

  async function handleUploadDoc() {
    if (!uploadFile) return
    setUploading(true); setUploadDone(false); setError("")
    try {
      const fd = new FormData(); fd.append("file",uploadFile); fd.append("type",uploadType)
      const res = await fetch(`/api/dossiers/${dossier.id}/documents`,{method:"POST",body:fd})
      if (!res.ok) { const d=await res.json(); throw new Error(d.error ?? t("common.error")) }
      setUploadDone(true); setUploadFile(null)
      const fresh = await fetch(`/api/dossiers/${dossier.id}`).then(r=>r.json())
      if (fresh.dossier) onSaved(fresh.dossier)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : t("common.error")) }
    finally { setUploading(false) }
  }

  const inp: React.CSSProperties = { width:"100%", padding:"8px 11px", borderRadius:"8px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#f8fafc", fontSize:"12px", outline:"none", fontFamily:"inherit", boxSizing:"border-box" }
  const sel: React.CSSProperties = { ...inp, background:"#0f1e3d", cursor:"pointer", appearance:"none" }
  const lbl: React.CSSProperties = { display:"block", fontSize:"9px", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"#475569", marginBottom:"5px" }
  const sectionTitle = (label: string, color = "#f5c842") => (
    <div style={{ display:"flex", alignItems:"center", gap:"8px", paddingBottom:"10px", borderBottom:"1px solid rgba(255,255,255,0.06)", marginBottom:"12px" }}>
      <div style={{ width:"3px", height:"16px", borderRadius:"2px", background:color }}/>
      <span style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color }}>{label}</span>
    </div>
  )

  const NIVEAUX = ["BACCALAUREAT","LICENCE_1","LICENCE_2","LICENCE_3","MASTER_1","MASTER_2","DOCTORAT","AUTRE"]
  const COURS   = ["COURS_JOUR","COURS_SOIR","FORMATION_CONTINUE"]
  const DIPLOMA_TYPES_LIST = ["BAC","LICENCE","MASTER","BTS","DOCTORAT","AUTRE"]

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 16px", borderRadius:"10px", border:"1px solid rgba(251,146,60,0.3)", background:"rgba(251,146,60,0.08)", color:"#fb923c", fontSize:"12.5px", fontWeight:600, cursor:"pointer", fontFamily:"inherit", marginTop:"16px", width:"100%" }}
      >
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"/></svg>
        Modifier le dossier complet
      </button>

      {/* Full-screen modal */}
      {open && (
        <div onClick={() => setOpen(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(8px)", zIndex:200, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"24px", overflowY:"auto" }}>
          <div onClick={e=>e.stopPropagation()} style={{ width:"100%", maxWidth:"860px", borderRadius:"20px", background:"rgba(10,20,42,0.98)", border:"1px solid rgba(255,255,255,0.1)", boxShadow:"0 40px 100px rgba(0,0,0,0.7)", margin:"auto", padding:"32px 36px" }}>

            {/* Header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"28px" }}>
              <div>
                <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"20px", fontWeight:600, color:"#f8fafc", margin:"0 0 4px" }}>Modifier le dossier</h2>
                <p style={{ fontSize:"12px", color:"#475569", margin:0 }}>Toutes les modifications sont enregistrées dans le journal d'audit et notifiées à l'étudiant.</p>
              </div>
              <button onClick={() => setOpen(false)} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:"20px" }}>✕</button>
            </div>

            {error && <div style={{ marginBottom:"20px", padding:"10px 14px", borderRadius:"10px", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", fontSize:"13px", color:"#fca5a5" }}>{error}</div>}

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"28px" }}>

              {/* ── Left column ── */}
              <div style={{ display:"flex", flexDirection:"column", gap:"24px" }}>

                {/* Personal info */}
                <div>
                  {sectionTitle("Informations personnelles", "#60a5fa")}
                  <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
                      <div><label style={lbl}>Nom</label><input value={nom} onChange={e=>setNom(e.target.value)} style={inp} placeholder="Nom de famille"/></div>
                      <div><label style={lbl}>Prénom</label><input value={prenom} onChange={e=>setPrenom(e.target.value)} style={inp} placeholder="Prénom"/></div>
                    </div>
                    <div><label style={lbl}>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} style={inp}/></div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
                      <div><label style={lbl}>Date de naissance</label><input type="date" value={dateNaissance} onChange={e=>setDateNaissance(e.target.value)} style={inp}/></div>
                      <div><label style={lbl}>Pays</label><input value={pays} onChange={e=>setPays(e.target.value)} style={inp} placeholder="Tunisie"/></div>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:"8px" }}>
                      <div>
                        <label style={lbl}>Pièce d'identité</label>
                        <select value={typeIdentite} onChange={e=>setTypeIdentite(e.target.value)} style={sel}>
                          <option value="">—</option>
                          <option value="CIN">CIN</option>
                          <option value="PASSEPORT">Passeport</option>
                        </select>
                      </div>
                      <div><label style={lbl}>Numéro</label><input value={numeroIdentite} onChange={e=>setNumeroIdentite(e.target.value)} style={inp} placeholder="12345678"/></div>
                    </div>
                    <div><label style={lbl}>Téléphone</label><input value={telephone} onChange={e=>setTelephone(e.target.value)} style={inp} placeholder="+216 XX XXX XXX"/></div>
                    <div><label style={lbl}>Adresse</label><input value={adresse} onChange={e=>setAdresse(e.target.value)} style={inp} placeholder="Adresse complète"/></div>
                  </div>
                </div>

                {/* Academic */}
                <div>
                  {sectionTitle("Parcours académique", "#a78bfa")}
                  <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                    <div>
                      <label style={lbl}>Niveau d'étude actuel</label>
                      <select value={niveauEtude} onChange={e=>setNiveauEtude(e.target.value)} style={sel}>
                        <option value="">—</option>
                        {NIVEAUX.map(v=><option key={v} value={v}>{t(`admin.dossierDetail.labels.niveau.${v}`)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Type de cours</label>
                      <select value={typeCours} onChange={e=>setTypeCours(e.target.value)} style={sel}>
                        <option value="">—</option>
                        {COURS.map(v=><option key={v} value={v}>{t(`admin.dossierDetail.labels.cours.${v}`)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Source de découverte</label>
                      <input value={sourceDecouverte} onChange={e=>setSourceDecouverte(e.target.value)} style={inp} placeholder="Réseaux sociaux, bouche-à-oreille…"/>
                    </div>
                  </div>
                </div>

                {/* Filière */}
                <div>
                  {sectionTitle("Filière demandée", "#4ade80")}
                  <select value={filiereId} onChange={e=>setFiliereId(e.target.value)} style={sel}>
                    <option value="">— Non sélectionnée —</option>
                    {filieres.map(f=><option key={f.id} value={f.id}>{f.nom}</option>)}
                  </select>
                </div>

                {/* Document upload */}
                <div>
                  {sectionTitle("Ajouter un document", "#f5c842")}
                  <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                    <select value={uploadType} onChange={e=>setUploadType(e.target.value)} style={sel}>
                      {["CNI","DIPLOME","RELEVE_NOTES","PHOTO","AUTRE"].map(v=><option key={v} value={v}>{v}</option>)}
                    </select>
                    <label style={{ display:"flex", alignItems:"center", gap:"8px", padding:"8px 12px", borderRadius:"8px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", cursor:"pointer" }}>
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#64748b" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/></svg>
                      <span style={{ fontSize:"11px", color:uploadFile?"#f5c842":"#64748b" }}>{uploadFile ? uploadFile.name : "Choisir un fichier…"}</span>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display:"none" }} onChange={e=>{const f=e.target.files?.[0];if(f){setUploadFile(f);setUploadDone(false)}}}/>
                    </label>
                    <button onClick={handleUploadDoc} disabled={!uploadFile||uploading} style={{ padding:"7px 14px", borderRadius:"8px", border:"none", background:!uploadFile||uploading?"rgba(74,222,128,0.2)":"linear-gradient(135deg,#4ade80,#22c55e)", color:!uploadFile||uploading?"#64748b":"#060d1f", fontSize:"12px", fontWeight:700, cursor:!uploadFile||uploading?"not-allowed":"pointer", fontFamily:"inherit" }}>
                      {uploading ? "Envoi…" : "Envoyer le document"}
                    </button>
                    {uploadDone && <div style={{ fontSize:"11px", color:"#4ade80" }}>✓ Document ajouté au dossier</div>}
                  </div>
                </div>
              </div>

              {/* ── Right column: Diplomas ── */}
              <div>
                {sectionTitle("Diplômes & Notes", "#f5c842")}
                <div style={{ display:"flex", flexDirection:"column", gap:"14px", maxHeight:"620px", overflowY:"auto", paddingRight:"4px" }}>
                  {diplomes.map((d, i) => {
                    const gradeKeys = d.type === "BAC" ? {
                      SCIENTIFIQUE: ["math","physique","francais","anglais","informatique"],
                      MATHS_INFO:   ["math","physique","informatique","francais","anglais"],
                      TECHNIQUE:    ["math","physique","francais","anglais","informatique"],
                      ECONOMIE:     ["math","gestion","informatique","francais","anglais"],
                      LETTRES:      ["francais","anglais","philosophie","histoire_geo"],
                    }[d.sousType] ?? ["math","physique","francais","anglais","moyenneGenerale"]
                    : d.type === "LICENCE" || d.type === "MASTER" ? ["moyenneGenerale"] : []
                    const allKeys = [...new Set([...gradeKeys, "moyenneGenerale"])]

                    return (
                      <div key={i} style={{ borderRadius:"12px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", overflow:"hidden" }}>
                        {/* Diploma header */}
                        <div style={{ padding:"10px 14px", background:"rgba(255,255,255,0.02)", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", gap:"8px", alignItems:"flex-end" }}>
                          <div style={{ flex:1 }}>
                            <label style={lbl}>Type</label>
                            <select value={d.type} onChange={e=>updDiplo(i,{type:e.target.value,sousType:"",champs:{}})} style={{...sel,fontSize:"11px",padding:"5px 8px"}}>
                              <option value="">—</option>
                              {DIPLOMA_TYPES_LIST.map(v=><option key={v} value={v}>{v}</option>)}
                            </select>
                          </div>
                          {d.type === "BAC" && (
                            <div style={{ flex:1 }}>
                              <label style={lbl}>Série</label>
                              <select value={d.sousType} onChange={e=>updDiplo(i,{sousType:e.target.value,champs:{}})} style={{...sel,fontSize:"11px",padding:"5px 8px"}}>
                                <option value="">—</option>
                                {["SCIENTIFIQUE","MATHS_INFO","TECHNIQUE","LETTRES","ECONOMIE","SPORT"].map(v=><option key={v} value={v}>{v}</option>)}
                              </select>
                            </div>
                          )}
                          <div>
                            <label style={lbl}>Année</label>
                            <input type="number" min="1990" max={new Date().getFullYear()} value={d.annee} onChange={e=>updDiplo(i,{annee:e.target.value})} style={{...inp,width:"76px",fontSize:"11px",padding:"5px 8px"}}/>
                          </div>
                          {diplomes.length > 1 && (
                            <button onClick={()=>setDiplomes(p=>p.filter((_,j)=>j!==i))} style={{width:"28px",height:"28px",borderRadius:"6px",border:"1px solid rgba(248,113,113,0.25)",background:"rgba(248,113,113,0.07)",color:"#f87171",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
                            </button>
                          )}
                        </div>
                        {/* Grades */}
                        {allKeys.length > 0 && (
                          <div style={{ padding:"10px 14px", display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"6px" }}>
                            {allKeys.map(k => (
                              <div key={k}>
                                <label style={{ ...lbl, fontSize:"8px" }}>{GRADE_LABELS[k] ?? k}</label>
                                <input
                                  type="number" min="0" max="20" step="0.25"
                                  value={d.champs[k] ?? ""}
                                  onChange={e=>updDiplo(i,{champs:{...d.champs,[k]:e.target.value}})}
                                  placeholder="—"
                                  style={{...inp,fontSize:"11px",padding:"4px 8px",textAlign:"center"}}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Intitule + etablissement */}
                        <div style={{ padding:"0 14px 10px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px" }}>
                          <div><label style={lbl}>Intitulé</label><input value={d.intitule} onChange={e=>updDiplo(i,{intitule:e.target.value})} style={{...inp,fontSize:"11px",padding:"4px 8px"}}/></div>
                          <div><label style={lbl}>Établissement</label><input value={d.etablissement} onChange={e=>updDiplo(i,{etablissement:e.target.value})} style={{...inp,fontSize:"11px",padding:"4px 8px"}}/></div>
                        </div>
                      </div>
                    )
                  })}
                  <button onClick={()=>setDiplomes(p=>[...p,{intitule:"",annee:"",etablissement:"",type:"",sousType:"",champs:{}}])} style={{ padding:"7px 12px", borderRadius:"8px", border:"1px dashed rgba(255,255,255,0.15)", background:"transparent", color:"#64748b", fontSize:"11px", cursor:"pointer", fontFamily:"inherit" }}>
                    + Ajouter un diplôme
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"24px", paddingTop:"20px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
              <p style={{ fontSize:"10.5px", color:"#334155", margin:0 }}>
                ⚠️ Toutes les modifications sont enregistrées dans le journal d'audit et notifiées à l'étudiant par notification.
              </p>
              <div style={{ display:"flex", gap:"10px" }}>
                <button onClick={()=>setOpen(false)} style={{ padding:"10px 20px", borderRadius:"10px", border:"1px solid rgba(255,255,255,0.1)", background:"transparent", color:"#94a3b8", fontSize:"13px", cursor:"pointer", fontFamily:"inherit" }}>Annuler</button>
                <button onClick={handleSave} disabled={saving} style={{ padding:"10px 24px", borderRadius:"10px", border:"none", background:saving?"rgba(251,146,60,0.4)":"linear-gradient(135deg,#fb923c,#f97316)", color:"#fff", fontSize:"13px", fontWeight:700, cursor:saving?"not-allowed":"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:"6px" }}>
                  {saving && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{animation:"spin 0.8s linear infinite"}}><circle cx="12" cy="12" r="10" stroke="#fff" strokeWidth="3" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round"/></svg>}
                  {saving ? "Enregistrement…" : "Enregistrer les modifications"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Document verification row ─────────────────────────────────────────────────

const STATIC_DOC_LABELS: Record<string, string> = {
  CNI:"Carte d'identité", PASSEPORT:"Passeport", DIPLOME:"Diplôme",
  RELEVE_NOTES:"Relevé de notes", PHOTO:"Photo d'identité", AUTRE:"Autre",
}

const VERIF_CFG = {
  VERIFIED:       { label:"Vérifié ✓",           color:"#4ade80", bg:"rgba(74,222,128,0.1)",  border:"rgba(74,222,128,0.25)"  },
  REJECTED:       { label:"Refusé ✗",             color:"#f87171", bg:"rgba(248,113,113,0.1)", border:"rgba(248,113,113,0.25)" },
  NEEDS_REUPLOAD: { label:"Qualité insuffisante ⚠", color:"#f5c842", bg:"rgba(245,200,66,0.1)",  border:"rgba(245,200,66,0.25)"  },
}

function DocVerifyRow({ doc, dossierId, onPreview, onUpdated }: {
  doc: Document
  dossierId: string
  onPreview: () => void
  onUpdated: (updated: Partial<Document>) => void
}) {
  const [open,    setOpen]    = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [note,    setNote]    = useState(doc.verificationNote ?? "")
  const [notify,  setNotify]  = useState(true)
  const [selected, setSelected] = useState<"VERIFIED"|"REJECTED"|"NEEDS_REUPLOAD"|"">(doc.verification ?? "")

  async function save() {
    if (!selected) return
    setSaving(true)
    try {
      const res = await fetch(`/api/dossiers/${dossierId}/documents/${doc.id}/verify`, {
        method: "PATCH", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ verification: selected, note: note.trim()||null, notify }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      onUpdated({ verification: data.document.verification, verificationNote: data.document.verificationNote })
      setOpen(false)
    } catch { /* keep open */ }
    finally { setSaving(false) }
  }

  const cfg = doc.verification ? VERIF_CFG[doc.verification] : null

  return (
    <div style={{ borderRadius:"10px", background:"rgba(255,255,255,0.03)", border:`1px solid ${cfg ? cfg.border : "rgba(255,255,255,0.06)"}`, overflow:"hidden" }}>
      {/* Row */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", flex:1, minWidth:0 }}>
          <span style={{ padding:"3px 8px", borderRadius:"6px", fontSize:"10px", fontWeight:700, background:"rgba(245,200,66,0.1)", color:"#f5c842", flexShrink:0 }}>{STATIC_DOC_LABELS[doc.type] ?? doc.type}</span>
          {cfg && <span style={{ fontSize:"10px", fontWeight:700, padding:"2px 7px", borderRadius:"20px", background:cfg.bg, color:cfg.color, flexShrink:0 }}>{cfg.label}</span>}
          {doc.verificationNote && <span style={{ fontSize:"10px", color:"#475569", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>"{doc.verificationNote}"</span>}
        </div>
        <div style={{ display:"flex", gap:"6px", flexShrink:0 }}>
          <button onClick={onPreview} style={{ fontSize:"11px", color:"#60a5fa", padding:"4px 10px", borderRadius:"6px", background:"rgba(96,165,250,0.1)", border:"none", cursor:"pointer", fontFamily:"inherit" }}>Voir</button>
          <button onClick={()=>setOpen(o=>!o)} style={{ fontSize:"11px", color:"#fb923c", padding:"4px 10px", borderRadius:"6px", background:"rgba(251,146,60,0.1)", border:"none", cursor:"pointer", fontFamily:"inherit" }}>
            {open ? "Fermer" : doc.verification ? "Modifier" : "Vérifier"}
          </button>
        </div>
      </div>

      {/* Inline verify panel */}
      {open && (
        <div style={{ padding:"12px 14px", borderTop:"1px solid rgba(255,255,255,0.06)", background:"rgba(0,0,0,0.15)", display:"flex", flexDirection:"column", gap:"10px" }}>
          {/* Status buttons */}
          <div style={{ display:"flex", gap:"6px" }}>
            {(["VERIFIED","REJECTED","NEEDS_REUPLOAD"] as const).map(v => {
              const c = VERIF_CFG[v]
              return (
                <button key={v} onClick={()=>setSelected(v)} style={{ flex:1, padding:"7px 4px", borderRadius:"8px", border:`1px solid ${selected===v ? c.border : "rgba(255,255,255,0.1)"}`, background:selected===v ? c.bg : "transparent", color:selected===v ? c.color : "#475569", fontSize:"10.5px", fontWeight:selected===v?700:400, cursor:"pointer", fontFamily:"inherit" }}>
                  {c.label}
                </button>
              )
            })}
          </div>
          {/* Note */}
          <input
            value={note} onChange={e=>setNote(e.target.value)}
            placeholder="Note pour l'étudiant (optionnel)…"
            style={{ padding:"7px 10px", borderRadius:"8px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#f8fafc", fontSize:"12px", outline:"none", fontFamily:"inherit" }}
          />
          {/* Notify checkbox + save */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <label style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"11px", color:"#64748b", cursor:"pointer" }}>
              <input type="checkbox" checked={notify} onChange={e=>setNotify(e.target.checked)} style={{ accentColor:"#f5c842" }}/>
              Notifier l'étudiant (notification + email)
            </label>
            <button onClick={save} disabled={!selected||saving} style={{ padding:"6px 16px", borderRadius:"8px", border:"none", background:!selected||saving?"rgba(251,146,60,0.3)":"linear-gradient(135deg,#fb923c,#f97316)", color:"#fff", fontSize:"12px", fontWeight:700, cursor:!selected||saving?"not-allowed":"pointer", fontFamily:"inherit" }}>
              {saving ? "…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Audit log panel ────────────────────────────────────────────────────────────

const ACTION_ICONS: Record<string, React.ReactNode> = {
  ADMIN_EDIT: (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"/>
    </svg>
  ),
  STATUT_CHANGE: (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"/>
    </svg>
  ),
  ANALYSE_RUN: (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 1-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"/>
    </svg>
  ),
  NOTE_ADDED: (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"/>
    </svg>
  ),
  DOCUMENT_UPLOADED: (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
    </svg>
  ),
}

const ACTION_CONFIG: Record<string, { color: string }> = {
  STATUT_CHANGE:     { color: "#60a5fa" },
  ANALYSE_RUN:       { color: "#f5c842" },
  NOTE_ADDED:        { color: "#a78bfa" },
  DOCUMENT_UPLOADED: { color: "#4ade80" },
  ADMIN_EDIT:        { color: "#fb923c" },
}

function AuditPanel({ dossierId, t, locale }: {
  dossierId: string
  t: (k: string, v?: Record<string, string | number>) => string
  locale: string
}) {
  const [logs, setLogs] = useState<{
    id: string; action: string; details: Record<string, unknown> | null; dateAction: string
    auteur: { nom: string | null; prenom: string | null; email: string }
  }[]>([])
  const [loaded, setLoaded] = useState(false)
  const [open, setOpen]     = useState(false)

  useEffect(() => {
    if (!open || loaded) return
    fetch(`/api/dossiers/${dossierId}/audit`).then((r) => r.json()).then((d) => { setLogs(d.logs ?? []); setLoaded(true) })
  }, [open, loaded, dossierId])

  const fmt = (d: string) => new Date(d).toLocaleString(
    locale === "ar" ? "ar-TN" : locale === "en" ? "en-GB" : "fr-FR",
    { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
  )

  function renderDetails(action: string, details: Record<string, unknown> | null) {
    if (!details) return null
    if (action === "STATUT_CHANGE") {
      return <span style={{ fontSize:"11px", color:"#64748b" }}>{String(details.from)} → {String(details.to)}{details.motif ? ` · "${String(details.motif).slice(0, 60)}…"` : ""}</span>
    }
    if (action === "ANALYSE_RUN") {
      return <span style={{ fontSize:"11px", color:"#64748b" }}>Score: {String(details.score)}/100 · {details.complet ? "Complet" : "Incomplet"}</span>
    }
    if (action === "DOCUMENT_UPLOADED") {
      return <span style={{ fontSize:"11px", color:"#64748b" }}>{String(details.type)} · {String(details.fileName)} · {String(details.sizeMb)} Mo</span>
    }
    if (action === "NOTE_ADDED") {
      return <span style={{ fontSize:"11px", color:"#64748b" }}>«{String(details.excerpt)}»</span>
    }
    return null
  }

  const panelStyle: React.CSSProperties = {
    padding: "24px 28px", borderRadius: "18px",
    background: "rgba(10,20,42,0.65)",
    border: "1px solid rgba(255,255,255,0.07)",
    marginBottom: "20px",
  }

  return (
    <div style={panelStyle}>
      <div onClick={() => setOpen((o) => !o)} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "16px", fontWeight: 500, color: "#f8fafc", margin: 0 }}>
          {t("admin.audit.title")}
        </h2>
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#475569" strokeWidth={2} style={{ transition:"transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0)" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7"/>
        </svg>
      </div>

      {open && (
        <div style={{ marginTop:"18px", animation:"fadeIn 0.2s ease both" }}>
          {!loaded ? (
            <div style={{ color:"#334155", fontSize:"13px" }}>{t("common.loading")}</div>
          ) : logs.length === 0 ? (
            <div style={{ fontSize:"13px", color:"#334155", fontStyle:"italic" }}>{t("admin.audit.empty")}</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"0" }}>
              {logs.map((log, i) => {
                const cfg = ACTION_CONFIG[log.action] ?? { icon: "•", color: "#475569" }
                const authorName = [log.auteur.prenom, log.auteur.nom].filter(Boolean).join(" ") || log.auteur.email
                return (
                  <div key={log.id} style={{ display:"flex", gap:"14px", paddingBottom:"14px", marginBottom: i < logs.length - 1 ? "14px" : 0, borderBottom: i < logs.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                    {/* Timeline dot */}
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
                      <div style={{ width:"28px", height:"28px", borderRadius:"8px", background:`${cfg.color}15`, border:`1px solid ${cfg.color}30`, display:"flex", alignItems:"center", justifyContent:"center", color: cfg.color }}>
                        {ACTION_ICONS[log.action] ?? <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="4" strokeWidth={2}/></svg>}
                      </div>
                      {i < logs.length - 1 && <div style={{ width:"1px", flex:1, background:"rgba(255,255,255,0.06)", marginTop:"6px" }}/>}
                    </div>
                    {/* Content */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:"8px", marginBottom:"3px" }}>
                        <span style={{ fontSize:"12px", fontWeight:600, color: cfg.color }}>
                          {t(`admin.audit.actions.${log.action}`) ?? log.action}
                        </span>
                        <span style={{ fontSize:"10px", color:"#334155", flexShrink:0 }}>{fmt(log.dateAction)}</span>
                      </div>
                      {renderDetails(log.action, log.details as Record<string, unknown> | null)}
                      <div style={{ fontSize:"11px", color:"#1e293b", marginTop:"2px" }}>{authorName}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function NotesPanel({ dossierId, t, locale, highlighted = false }: {
  dossierId: string
  t: (k: string, v?: Record<string, string | number>) => string
  locale: string
  highlighted?: boolean
}) {
  const [notes, setNotes]     = useState<{ id: string; contenu: string; dateCreation: string; auteur: { nom: string | null; prenom: string | null; email: string } }[]>([])
  const [newNote, setNewNote] = useState("")
  const [saving, setSaving]   = useState(false)
  const [loaded, setLoaded]   = useState(false)

  useEffect(() => {
    fetch(`/api/dossiers/${dossierId}/notes`).then((r) => r.json()).then((d) => { setNotes(d.notes ?? []); setLoaded(true) })
  }, [dossierId])

  async function addNote() {
    if (!newNote.trim()) return
    setSaving(true)
    const res = await fetch(`/api/dossiers/${dossierId}/notes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contenu: newNote.trim() }),
    })
    if (res.ok) {
      const data = await res.json()
      setNotes((p) => [data.note, ...p])
      setNewNote("")
    }
    setSaving(false)
  }

  const noteCardStyle: React.CSSProperties = {
    padding: "24px 28px", borderRadius: "18px",
    background: highlighted ? "rgba(167,139,250,0.05)" : "rgba(10,20,42,0.65)",
    border: highlighted ? "1px solid rgba(167,139,250,0.2)" : "1px solid rgba(255,255,255,0.07)",
    marginBottom: "20px",
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString(
    locale === "ar" ? "ar-TN" : locale === "en" ? "en-GB" : "fr-FR",
    { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
  )

  return (
    <div style={noteCardStyle}>
      <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "16px", fontWeight: 500, color: "#f8fafc", margin: "0 0 16px" }}>
        {t("admin.notes.title")}
      </h2>

      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <textarea
          value={newNote} onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addNote() }}
          placeholder={t("admin.notes.placeholder")}
          rows={2}
          style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f8fafc", fontSize: "13px", outline: "none", fontFamily: "inherit", resize: "vertical", lineHeight: 1.5, boxSizing: "border-box" }}
        />
        <button onClick={addNote} disabled={saving || !newNote.trim()} style={{ padding: "0 16px", borderRadius: "10px", border: "none", background: newNote.trim() ? "linear-gradient(135deg,#f5c842,#e8a820)" : "rgba(245,200,66,0.2)", color: newNote.trim() ? "#060d1f" : "#64748b", fontSize: "12px", fontWeight: 700, cursor: newNote.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", flexShrink: 0, alignSelf: "flex-end", height: "40px" }}>
          {saving ? "…" : t("admin.notes.add")}
        </button>
      </div>

      {!loaded ? (
        <div style={{ color: "#334155", fontSize: "13px" }}>{t("common.loading")}</div>
      ) : notes.length === 0 ? (
        <div style={{ fontSize: "13px", color: "#334155", fontStyle: "italic" }}>{t("admin.notes.empty")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {notes.map((n) => {
            const authorName = [n.auteur.prenom, n.auteur.nom].filter(Boolean).join(" ") || n.auteur.email
            return (
              <div key={n.id} style={{ padding: "12px 14px", borderRadius: "10px", background: "rgba(245,200,66,0.04)", border: "1px solid rgba(245,200,66,0.12)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#f5c842" }}>{authorName}</span>
                  <span style={{ fontSize: "10px", color: "#334155" }}>{fmt(n.dateCreation)}</span>
                </div>
                <p style={{ fontSize: "13px", color: "#cbd5e1", lineHeight: 1.6, margin: 0 }}>{n.contenu}</p>
              </div>
            )
          })}
        </div>
      )}
      <p style={{ fontSize: "10.5px", color: "#1e293b", marginTop: "10px", marginBottom: 0 }}>{t("admin.notes.private")}</p>
    </div>
  )
}

function InfoField({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div style={{ padding: "12px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", gridColumn: wide ? "1 / -1" : undefined }}>
      <div style={{ fontSize: "10px", color: "#475569", fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", marginBottom: "5px" }}>{label}</div>
      <div style={{ fontSize: "13px", color: value === "—" ? "#334155" : "#f8fafc", fontWeight: 500 }}>{value}</div>
    </div>
  )
}

// ── Admin message panel ────────────────────────────────────────────────────────

function MessagePanel({ dossierId }: { dossierId: string }) {
  const [open,    setOpen]    = useState(false)
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [err,     setErr]     = useState("")

  async function send() {
    if (!message.trim() || sending) return
    setSending(true); setErr("")
    try {
      const res = await fetch("/api/admin/message", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dossierId, message: message.trim() }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Erreur") }
      setSent(true); setMessage(""); setTimeout(() => setSent(false), 4000)
      setOpen(false)
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Erreur") }
    finally { setSending(false) }
  }

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 16px", borderRadius:"10px", border:"1px solid rgba(96,165,250,0.3)", background:"rgba(96,165,250,0.08)", color:"#60a5fa", fontSize:"12.5px", fontWeight:600, cursor:"pointer", fontFamily:"inherit", marginTop:"10px", width:"100%" }}
      >
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"/>
        </svg>
        Envoyer un message
      </button>

      {sent && (
        <div style={{ marginTop:"8px", padding:"8px 12px", borderRadius:"8px", background:"rgba(74,222,128,0.1)", border:"1px solid rgba(74,222,128,0.25)", fontSize:"12px", color:"#4ade80" }}>
          ✓ Message envoyé à l'étudiant
        </div>
      )}

      {open && (
        <div style={{ marginTop:"12px", padding:"14px", borderRadius:"12px", background:"rgba(96,165,250,0.06)", border:"1px solid rgba(96,165,250,0.2)", animation:"fadeIn 0.15s ease both" }}>
          <div style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:"#60a5fa", marginBottom:"10px" }}>
            Message à l'étudiant
          </div>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Saisissez votre message… (visible par l'étudiant via notification + email)"
            rows={4}
            maxLength={2000}
            style={{ width:"100%", padding:"10px 12px", borderRadius:"9px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(96,165,250,0.25)", color:"#f8fafc", fontSize:"12.5px", outline:"none", fontFamily:"inherit", resize:"vertical", lineHeight:1.6, boxSizing:"border-box" }}
            autoFocus
          />
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"8px" }}>
            <span style={{ fontSize:"10px", color: message.length > 1800 ? "#f87171" : "#334155" }}>
              {message.length}/2000
            </span>
            <div style={{ display:"flex", gap:"6px" }}>
              <button
                onClick={() => { setOpen(false); setMessage(""); setErr("") }}
                style={{ padding:"7px 14px", borderRadius:"8px", border:"1px solid rgba(255,255,255,0.1)", background:"transparent", color:"#64748b", fontSize:"12px", cursor:"pointer", fontFamily:"inherit" }}
              >
                Annuler
              </button>
              <button
                onClick={send}
                disabled={!message.trim() || sending}
                style={{ padding:"7px 18px", borderRadius:"8px", border:"none", background:message.trim()&&!sending?"linear-gradient(135deg,#60a5fa,#3b82f6)":"rgba(96,165,250,0.25)", color:message.trim()&&!sending?"#fff":"#64748b", fontSize:"12px", fontWeight:700, cursor:message.trim()&&!sending?"pointer":"not-allowed", fontFamily:"inherit", display:"flex", alignItems:"center", gap:"5px" }}
              >
                {sending && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style={{animation:"spin 0.8s linear infinite"}}><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>}
                {sending ? "Envoi…" : "Envoyer"}
              </button>
            </div>
          </div>
          {err && <div style={{ marginTop:"8px", fontSize:"11px", color:"#fca5a5" }}>{err}</div>}
        </div>
      )}
    </>
  )
}

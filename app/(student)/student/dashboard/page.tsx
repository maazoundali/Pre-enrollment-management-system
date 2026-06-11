"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n-context"
import { useIsMobile } from "@/lib/use-mobile"
import Link from "next/link"
import { useRouter } from "next/navigation"
import ConfirmModal from "@/components/ConfirmModal"
import { SkeletonStyles, SkeletonDossierCard } from "@/components/Skeleton"
import EnrollmentBanner from "@/components/EnrollmentBanner"
import OnboardingTour from "@/components/OnboardingTour"

interface Dossier {
  id: string; statut: string; score: number | null
  dateCreation: string; dateMaj: string
  motifRejet: string | null
  rangListeAttente: number | null
  filiere: { id: string; nom: string } | null
  _count?: { documents: number }
  analyses: { filiereRecommandations: { rang: number; filiere: { nom: string } }[] }[]
}

const STEPS = ["BROUILLON", "SOUMIS", "EN_ANALYSE", "VALIDE"]

function StatusTimeline({ statut, cfg, allCfg }: {
  statut: string
  cfg: { label: string; color: string; bg: string }
  allCfg: Record<string, { label: string; color: string; bg: string }>
}) {
  const isRejected = statut === "REJETE"
  const currentIdx = STEPS.indexOf(statut)
  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%", marginTop: "24px" }}>
      {STEPS.map((s, i) => {
        const done = !isRejected && i < currentIdx
        const active = !isRejected && i === currentIdx
        const sc = allCfg[s] ?? allCfg.BROUILLON
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, flexShrink: 0, background: done ? "linear-gradient(135deg,#f5c842,#e8a820)" : active ? sc.bg : "rgba(255,255,255,0.04)", border: done ? "none" : active ? `2px solid ${sc.color}` : "1px solid rgba(255,255,255,0.08)", color: done ? "#060d1f" : active ? sc.color : "#334155", boxShadow: active ? `0 0 16px ${sc.color}35` : "none" }}>
                {done ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: "10px", color: done ? "#f5c842" : active ? sc.color : "#334155", fontWeight: active || done ? 600 : 400, whiteSpace: "nowrap" }}>
                {sc.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: "2px", marginBottom: "22px", background: done ? "linear-gradient(90deg,#f5c842,rgba(245,200,66,0.3))" : "rgba(255,255,255,0.07)" }}/>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const { t, locale } = useI18n()
  const isMobile = useIsMobile()
  const router   = useRouter()
  const [dossiers, setDossiers]         = useState<Dossier[]>([])
  const [loading, setLoading]           = useState(true)
  const [deleting, setDeleting]         = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  useEffect(() => {
    fetch("/api/dossiers?limit=20")
      .then((r) => r.json())
      .then((d) => setDossiers(d.dossiers ?? []))
      .finally(() => setLoading(false))
  }, [])

  // Current = latest dossier; history = all previous ones
  const dossier  = dossiers[0] ?? null
  const history  = dossiers.slice(1)

  async function handleDelete() {
    if (!dossier) return
    setDeleting(true)
    const res = await fetch(`/api/dossiers/${dossier.id}`, { method: "DELETE" })
    if (res.ok) setDossiers((prev) => prev.filter((d) => d.id !== dossier.id))
    setDeleting(false)
    setShowDeleteModal(false)
  }

  const STATUT_CFG: Record<string, { label: string; color: string; bg: string; description: string }> = {
    BROUILLON:  { label: t("statut.BROUILLON.label"), color: "#94a3b8", bg: "rgba(148,163,184,0.1)", description: t("statut.BROUILLON.description") },
    SOUMIS:     { label: t("statut.SOUMIS.label"),     color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  description: t("statut.SOUMIS.description") },
    EN_ANALYSE: { label: t("statut.EN_ANALYSE.label"), color: "#f5c842", bg: "rgba(245,200,66,0.1)",  description: t("statut.EN_ANALYSE.description") },
    VALIDE:     { label: t("statut.VALIDE.label"),     color: "#4ade80", bg: "rgba(74,222,128,0.1)",  description: t("statut.VALIDE.description") },
    REJETE:        { label: t("statut.REJETE.label"),        color: "#f87171", bg: "rgba(248,113,113,0.1)", description: t("statut.REJETE.description") },
    LISTE_ATTENTE: { label: t("statut.LISTE_ATTENTE.label"), color: "#a78bfa", bg: "rgba(167,139,250,0.1)", description: t("statut.LISTE_ATTENTE.description") },
  }

  const fullName = [user?.prenom, user?.nom].filter(Boolean).join(" ") || "Étudiant"
  const cfg = dossier ? (STATUT_CFG[dossier.statut] ?? STATUT_CFG.BROUILLON) : null
  const topRec = dossier?.analyses?.[0]?.filiereRecommandations?.find((r) => r.rang === 1)

  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "36px 40px" }}>
      <SkeletonStyles />

      {!loading && !dossier && !isMobile && (
        <OnboardingTour
          storageKey="onboarding_student_v1_seen"
          labels={{ step: t("onboarding.stepLabel"), skip: t("onboarding.skip"), next: t("onboarding.next"), done: t("onboarding.done") }}
          steps={[
            { target: "#tour-greeting",      title: t("onboarding.student.step1Title"), body: t("onboarding.student.step1Body") },
            { target: "#tour-start-btn",     title: t("onboarding.student.step2Title"), body: t("onboarding.student.step2Body") },
            { target: "#tour-filieres-link", title: t("onboarding.student.step3Title"), body: t("onboarding.student.step3Body") },
            { target: "#tour-notif-bell",    title: t("onboarding.student.step4Title"), body: t("onboarding.student.step4Body") },
          ]}
        />
      )}

      <ConfirmModal
        open={showDeleteModal}
        title={t("student.dashboard.deleteModal.title")}
        message={t("student.dashboard.deleteModal.message")}
        confirmLabel={t("student.dashboard.deleteModal.confirm")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />

      {/* Greeting */}
      <div style={{ marginBottom: "36px" }}>
        <div style={{ fontSize: "12px", color: "#334155", marginBottom: "6px" }}>
          {new Date().toLocaleDateString(locale === "ar" ? "ar-TN" : locale === "en" ? "en-GB" : "fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </div>
        <h1 id="tour-greeting" style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: "28px", fontWeight: 600, color: "#f8fafc", margin: 0 }}>
          {t("student.dashboard.greeting", { name: fullName })}
        </h1>
      </div>

      <EnrollmentBanner variant="compact" />

      {loading ? (
        <div style={{ maxWidth: "640px" }}><SkeletonDossierCard /></div>
      ) : !dossier ? (
        <div style={{ maxWidth: "640px" }}>
          {/* Welcome banner */}
          <div style={{ padding: "28px 32px", borderRadius: "20px", background: "linear-gradient(135deg, rgba(22,48,96,0.7) 0%, rgba(10,20,42,0.8) 100%)", border: "1px solid rgba(245,200,66,0.2)", marginBottom: "16px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, right: 0, width: "180px", height: "180px", background: "radial-gradient(circle at top right, rgba(245,200,66,0.07) 0%, transparent 70%)", pointerEvents: "none" }}/>
            <h2 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: "20px", fontWeight: 600, color: "#f8fafc", margin: "0 0 10px" }}>
              {t("student.dashboard.welcome.title")}
            </h2>
            <p style={{ fontSize: "13px", color: "#64748b", margin: "0 0 22px", lineHeight: 1.7 }}>
              {t("student.dashboard.welcome.subtitle")}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginBottom: "24px" }}>
              {([
                t("student.dashboard.welcome.step1"),
                t("student.dashboard.welcome.step2"),
                t("student.dashboard.welcome.step3"),
                t("student.dashboard.welcome.step4"),
              ]).map((label, i) => (
                <div key={i} style={{ padding: "10px 8px", borderRadius: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
                  <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: "rgba(245,200,66,0.1)", border: "1px solid rgba(245,200,66,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px", fontSize: "11px", fontWeight: 700, color: "#f5c842" }}>{i + 1}</div>
                  <div style={{ fontSize: "10px", color: "#94a3b8", lineHeight: 1.3 }}>{label}</div>
                </div>
              ))}
            </div>
            <Link id="tour-start-btn" href="/student/dossier/new" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 26px", borderRadius: "12px", background: "linear-gradient(135deg,#f5c842,#e8a820)", color: "#060d1f", fontSize: "14px", fontWeight: 700, textDecoration: "none", boxShadow: "0 4px 16px rgba(232,184,32,0.3)" }}>
              {t("student.dashboard.welcome.start")}
            </Link>
          </div>

          {/* Documents reminder */}
          <div style={{ padding: "20px 24px", borderRadius: "16px", background: "rgba(10,20,42,0.5)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#475569", marginBottom: "12px" }}>{t("student.dashboard.welcome.docsTitle")}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {[
                t("student.dashboard.welcome.docCin"),
                t("student.dashboard.welcome.docDiplome"),
                t("student.dashboard.welcome.docReleve"),
                t("student.dashboard.welcome.docPhoto"),
              ].map((label) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", fontSize: "12px", color: "#94a3b8" }}>
                  <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#475569", flexShrink: 0 }}/>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: "640px" }}>
          <div style={{ padding: "30px 32px", borderRadius: "20px", background: "rgba(10,20,42,0.65)", border: `1px solid ${cfg!.color}30`, boxShadow: `0 0 40px ${cfg!.color}08` }}>

            {/* Status badge + filière */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
              <div>
                <div style={{ fontSize: "11px", color: "#475569", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                  {t("student.dashboard.dossier.candidature")}
                </div>
                <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: "20px", fontWeight: 600, color: "#f8fafc" }}>
                  {dossier.filiere?.nom ?? t("student.dashboard.dossier.filiereNotSelected")}
                </div>
                <div style={{ fontSize: "12px", color: "#334155", marginTop: "4px" }}>
                  {new Date(dossier.dateCreation).toLocaleDateString(locale === "ar" ? "ar-TN" : locale === "en" ? "en-GB" : "fr-FR")}
                </div>
              </div>
              <div style={{ padding: "6px 14px", borderRadius: "20px", background: cfg!.bg, color: cfg!.color, fontSize: "12px", fontWeight: 700, flexShrink: 0, display: "flex", alignItems: "center", gap: "7px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: cfg!.color, flexShrink: 0 }}/>
                {cfg!.label}
              </div>
            </div>

            <p style={{ fontSize: "13px", color: "#64748b", margin: "14px 0 0", lineHeight: 1.6 }}>
              {cfg!.description}
            </p>

            {/* Waitlist position badge */}
            {dossier.statut === "LISTE_ATTENTE" && dossier.rangListeAttente && (
              <div style={{ marginTop: "16px", padding: "12px 16px", borderRadius: "12px", background: "rgba(167,139,250,0.07)", border: "1px solid rgba(167,139,250,0.2)", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "20px" }}>🕐</span>
                <div>
                  <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "3px" }}>
                    {t("student.dashboard.waitlist.position")}
                  </div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#a78bfa" }}>
                    #{dossier.rangListeAttente}
                  </div>
                </div>
              </div>
            )}

            {topRec && dossier.statut !== "BROUILLON" && (
              <div style={{ marginTop: "20px", padding: "14px 16px", borderRadius: "12px", background: "rgba(245,200,66,0.07)", border: "1px solid rgba(245,200,66,0.2)", display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f5c842", flexShrink: 0 }}/>
                <div>
                  <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "3px" }}>
                    {t("student.dashboard.dossier.recommendedFiliere")}
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#f5c842" }}>{topRec.filiere.nom}</div>
                </div>
              </div>
            )}

            {dossier.statut !== "REJETE" ? (
              <StatusTimeline statut={dossier.statut} cfg={cfg!} allCfg={STATUT_CFG} />
            ) : (
              <div style={{ marginTop: "20px", padding: "16px 18px", borderRadius: "12px", background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.2)" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#f87171", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: dossier.motifRejet ? "8px" : "0" }}>
                  {t("student.dashboard.dossier.rejected")}
                </div>
                {dossier.motifRejet && (
                  <div style={{ fontSize: "13px", color: "#fca5a5", lineHeight: 1.65 }}>{dossier.motifRejet}</div>
                )}
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "8px" }}>
                  {t("student.dashboard.dossier.canCorrect")}
                </div>
              </div>
            )}

            {/* Documents count + actions */}
            <div style={{ marginTop: "20px", paddingTop: "18px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "12px", color: "#475569" }}>
                📄 {dossier._count?.documents ?? 0} document{(dossier._count?.documents ?? 0) !== 1 ? "s" : ""}
              </span>

              <div style={{ display: "flex", gap: "8px" }}>
                {dossier.statut !== "BROUILLON" && (
                  <button onClick={() => router.push(`/student/dossier/${dossier.id}`)} style={{ padding: "7px 16px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "#94a3b8", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}>
                    {t("student.dashboard.dossier.view")}
                  </button>
                )}

                {dossier.statut === "BROUILLON" && (
                  <>
                    <button onClick={() => router.push(`/student/dossier/${dossier.id}/edit`)} style={{ padding: "7px 16px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg,#f5c842,#e8a820)", color: "#060d1f", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      {t("student.dashboard.dossier.continue")}
                    </button>
                    <button onClick={() => setShowDeleteModal(true)} disabled={deleting} style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid rgba(248,113,113,0.25)", background: "rgba(248,113,113,0.08)", color: "#f87171", fontSize: "12px", cursor: deleting ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                      {deleting ? "…" : t("student.dashboard.deleteModal.confirm")}
                    </button>
                  </>
                )}

                {dossier.statut === "REJETE" && (
                  <button onClick={() => router.push(`/student/dossier/${dossier.id}/edit`)} style={{ padding: "7px 16px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg,#f5c842,#e8a820)", color: "#060d1f", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    {t("student.dashboard.dossier.correctAndResubmit")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Application history ─────────────────────────────────────────────── */}
      {history.length > 0 && (
        <div style={{ maxWidth: "640px", marginTop: "28px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#334155", marginBottom: "14px" }}>
            {t("student.dashboard.history.title")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {history.map((h) => {
              const hCfg = STATUT_CFG[h.statut] ?? STATUT_CFG.BROUILLON
              return (
                <div key={h.id} style={{ padding: "14px 18px", borderRadius: "14px", background: "rgba(10,20,42,0.4)", border: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", opacity: 0.7 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 500, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {h.filiere?.nom ?? t("student.dashboard.dossier.filiereNotSelected")}
                    </div>
                    <div style={{ fontSize: "11px", color: "#334155", marginTop: "2px" }}>
                      {new Date(h.dateCreation).toLocaleDateString(locale === "ar" ? "ar-TN" : locale === "en" ? "en-GB" : "fr-FR")}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                    <span style={{ padding: "3px 10px", borderRadius: "20px", background: hCfg.bg, color: hCfg.color, fontSize: "11px", fontWeight: 600 }}>{hCfg.label}</span>
                    <button onClick={() => router.push(`/student/dossier/${h.id}`)} style={{ padding: "5px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#64748b", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}>
                      {t("common.see")}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

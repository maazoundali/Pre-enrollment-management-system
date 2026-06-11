"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n-context"
import LanguageSwitcher from "@/components/LanguageSwitcher"
import TermsModal from "@/components/TermsModal"

const inp: React.CSSProperties = {
  display:"block", width:"100%", padding:"12px 16px",
  fontSize:"14px", color:"#f8fafc",
  background:"rgba(255,255,255,0.06)",
  border:"1px solid rgba(255,255,255,0.12)",
  borderRadius:"12px", outline:"none",
  transition:"border-color 0.2s, box-shadow 0.2s",
  boxSizing:"border-box", fontFamily:"inherit",
}
const sel: React.CSSProperties = {
  ...inp, appearance:"none", WebkitAppearance:"none",
  background:"#0f1e3d", cursor:"pointer",
}
const lbl: React.CSSProperties = {
  display:"block", fontSize:"10.5px", fontWeight:700,
  letterSpacing:"0.12em", textTransform:"uppercase",
  color:"#64748b", marginBottom:"8px",
}

export default function RegisterPage() {
  const router      = useRouter()
  const { refresh } = useAuth()
  const { t }       = useI18n()

  const [email, setEmail]         = useState("")
  const [motDePasse, setPassword] = useState("")
  const [confirm, setConfirm]     = useState("")
  const [nom, setNom]             = useState("")
  const [prenom, setPrenom]       = useState("")
  const [sexe, setSexe]           = useState("")
  const [consent, setConsent]     = useState(false)
  const [showTerms, setShowTerms]   = useState(false)
  const [showVerify, setShowVerify] = useState(false)
  const [error, setError]           = useState("")
  const [loading, setLoading]       = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError("")
    if (!nom.trim() || !prenom.trim()) { setError(t("auth.register.errorNameRequired")); return }
    if (motDePasse.length < 6) { setError(t("auth.register.errorPasswordMin")); return }
    if (motDePasse !== confirm) { setError(t("auth.register.errorPasswordMatch")); return }
    if (!consent) { setError(t("auth.register.errorConsent")); return }
    setLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, motDePasse, role: "ETUDIANT", nom: nom.trim(), prenom: prenom.trim(), sexe: sexe || undefined, consentementRGPD: true }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? t("common.error")) }
      await refresh()
      setShowVerify(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("auth.register.defaultError"))
    } finally { setLoading(false) }
  }

  return (
    <>
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      {showVerify && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(6px)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px", animation:"fadeIn 0.2s ease both" }}>
          <div style={{ width:"100%", maxWidth:"440px", borderRadius:"20px", background:"rgba(10,20,42,0.98)", border:"1px solid rgba(245,200,66,0.22)", boxShadow:"0 32px 80px rgba(0,0,0,0.7)", padding:"32px 28px", textAlign:"center", animation:"slideUp 0.25s ease both" }}>
            <div style={{ width:"56px", height:"56px", margin:"0 auto 20px", borderRadius:"16px", background:"linear-gradient(135deg,#f5c842,#e8a820)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 10px 30px rgba(232,184,32,0.35)" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#060d1f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4z"/><path d="m4 6 8 6 8-6"/></svg>
            </div>
            <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"18px", fontWeight:600, color:"#f8fafc", margin:"0 0 12px" }}>
              {t("auth.register.verifyTitle")}
            </h2>
            <p style={{ fontSize:"13px", color:"#94a3b8", lineHeight:1.7, margin:"0 0 24px" }}>
              {t("auth.register.verifyBody", { email })}
            </p>
            <button onClick={() => router.push("/student/dashboard")} style={{ width:"100%", padding:"13px", borderRadius:"12px", border:"none", background:"linear-gradient(135deg,#f5c842,#e8a820)", color:"#060d1f", fontSize:"13px", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              {t("auth.register.verifyContinue")}
            </button>
          </div>
        </div>
      )}
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        .ri::placeholder{color:#475569}
        .ri:focus{border-color:#e8b820!important;box-shadow:0 0 0 3px rgba(232,184,32,0.18)!important}
        .sel-reg option{background:#0f1e3d;color:#f8fafc}
      `}</style>

      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px", backgroundColor:"#060d1f", backgroundImage:`radial-gradient(ellipse 80% 50% at 50% -10%, rgba(22,48,96,0.9) 0%, transparent 70%), linear-gradient(rgba(245,200,66,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(245,200,66,0.035) 1px, transparent 1px)`, backgroundSize:"100% 100%, 56px 56px, 56px 56px" }}>
        <div style={{ width:"100%", maxWidth:"460px", animation:"fadeUp 0.65s cubic-bezier(0.16,1,0.3,1) both" }}>

          {/* Language switcher */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
            <LanguageSwitcher />
          </div>

          {/* Brand */}
          <div style={{ textAlign:"center", marginBottom:"32px" }}>
            <img src="/logo.png" alt="IIT" style={{ height:"110px", width:"auto", display:"block", margin:"0 auto 16px", borderRadius:"12px" }} />
            <p style={{ marginTop:"4px", fontSize:"13px", color:"#64748b" }}>{t("auth.register.subtitle")}</p>
          </div>

          {/* Card */}
          <div style={{ padding:"36px", borderRadius:"24px", background:"rgba(10,20,42,0.78)", border:"1px solid rgba(245,200,66,0.16)", backdropFilter:"blur(28px)", WebkitBackdropFilter:"blur(28px)", boxShadow:"0 40px 100px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)" }}>

            <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"19px", fontWeight:500, color:"#f8fafc", margin:"0 0 24px" }}>
              {t("auth.register.formTitle")}
            </h2>

            {error && (
              <div style={{ marginBottom:"20px", padding:"12px 16px", borderRadius:"12px", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.28)", fontSize:"13px", color:"#fca5a5" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:"18px" }}>
              {/* Prénom + Nom */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                <div>
                  <label style={lbl}>{t("auth.register.firstName")}</label>
                  <input type="text" required value={prenom} onChange={(e) => setPrenom(e.target.value)}
                    placeholder={t("auth.register.firstNamePlaceholder")} className="ri" style={inp}/>
                </div>
                <div>
                  <label style={lbl}>{t("auth.register.lastName")}</label>
                  <input type="text" required value={nom} onChange={(e) => setNom(e.target.value)}
                    placeholder={t("auth.register.lastNamePlaceholder")} className="ri" style={inp}/>
                </div>
              </div>

              {/* Sexe */}
              <div>
                <label style={lbl}>{t("auth.register.gender")}</label>
                <select value={sexe} onChange={(e) => setSexe(e.target.value)} className="sel-reg" style={sel}>
                  <option value="">{t("auth.register.genderNotSpecified")}</option>
                  <option value="HOMME">{t("auth.register.male")}</option>
                  <option value="FEMME">{t("auth.register.female")}</option>
                  <option value="AUTRE">{t("auth.register.other")}</option>
                </select>
              </div>

              {/* Connexion */}
              <div style={{ borderTop:"1px solid rgba(255,255,255,0.07)", paddingTop:"18px" }}>
                <p style={{ fontSize:"11px", color:"#475569", margin:"0 0 16px", lineHeight:1.6 }}>
                  {t("auth.register.connectionInfo")}
                </p>
                <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
                  <div>
                    <label style={lbl}>{t("auth.register.email")}</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="vous@example.com" className="ri" style={inp}/>
                  </div>
                  <div>
                    <label style={lbl}>{t("auth.register.password")}</label>
                    <input type="password" required value={motDePasse} onChange={(e) => setPassword(e.target.value)}
                      placeholder={t("auth.register.passwordPlaceholder")} className="ri" style={inp}/>
                  </div>
                  <div>
                    <label style={lbl}>{t("auth.register.confirmPassword")}</label>
                    <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••" className="ri" style={inp}/>
                  </div>
                </div>
              </div>

              {/* Consent checkbox */}
              <div onClick={() => setConsent(!consent)} style={{ display:"flex", alignItems:"flex-start", gap:"12px", padding:"14px 16px", borderRadius:"12px", background: consent ? "rgba(245,200,66,0.06)" : "rgba(255,255,255,0.03)", border:`1px solid ${consent ? "rgba(245,200,66,0.3)" : "rgba(255,255,255,0.08)"}`, cursor:"pointer", transition:"all 0.2s", userSelect:"none" }}>
                <div style={{ width:"20px", height:"20px", borderRadius:"6px", flexShrink:0, marginTop:"1px", background: consent ? "linear-gradient(135deg,#f5c842,#e8a820)" : "rgba(255,255,255,0.07)", border: consent ? "none" : "1.5px solid rgba(255,255,255,0.18)", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s", boxShadow: consent ? "0 2px 10px rgba(232,184,32,0.45)" : "none" }}>
                  {consent && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6.5l2.8 2.8 5-5.5" stroke="#060d1f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span style={{ fontSize:"12px", color: consent ? "#cbd5e1" : "#94a3b8", lineHeight:1.6, transition:"color 0.2s" }}>
                  {t("auth.register.consentText")}{" "}
                  <button type="button" onClick={(e) => { e.stopPropagation(); setShowTerms(true) }} style={{ background:"none", border:"none", color:"#f5c842", fontSize:"12px", textDecoration:"underline", cursor:"pointer", padding:0, fontFamily:"inherit" }}>
                    {t("auth.register.consentLink")}
                  </button>
                </span>
              </div>

              <button type="submit" disabled={loading} style={{ marginTop:"4px", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px", width:"100%", padding:"14px 24px", borderRadius:"14px", border:"none", cursor:loading?"not-allowed":"pointer", fontSize:"14px", fontWeight:700, letterSpacing:"0.03em", color:"#060d1f", background:loading?"rgba(232,184,32,0.45)":"linear-gradient(135deg,#f5c842,#e8a820)", boxShadow:loading?"none":"0 6px 24px rgba(232,184,32,0.35)", fontFamily:"inherit" }}>
                {loading ? (
                  <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation:"spin 0.8s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="#060d1f" strokeWidth="3" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#060d1f" strokeWidth="3" strokeLinecap="round"/></svg>{t("auth.register.creating")}</>
                ) : t("auth.register.submit")}
              </button>
            </form>

            <div style={{ marginTop:"24px", paddingTop:"20px", borderTop:"1px solid rgba(255,255,255,0.07)", textAlign:"center", fontSize:"13px", color:"#475569" }}>
              {t("auth.register.alreadyRegistered")}{" "}
              <Link href="/login" style={{ color:"#f5c842", fontWeight:600, textDecoration:"none" }}>{t("auth.register.loginLink")}</Link>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

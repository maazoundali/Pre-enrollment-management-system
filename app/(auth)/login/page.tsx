"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n-context"
import Link from "next/link"
import LanguageSwitcher from "@/components/LanguageSwitcher"

export default function LoginPage() {
  const { login } = useAuth()
  const { t } = useI18n()
  const [email, setEmail]         = useState("")
  const [motDePasse, setPassword] = useState("")
  const [error, setError]         = useState("")
  const [loading, setLoading]     = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await login(email, motDePasse)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("auth.login.defaultError"))
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    display: "block", width: "100%", padding: "12px 16px", fontSize: "14px",
    color: "#f8fafc", background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)", borderRadius: "12px",
    outline: "none", transition: "border-color 0.2s, box-shadow 0.2s",
    boxSizing: "border-box", fontFamily: "inherit",
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin   { to { transform: rotate(360deg); } }
        .login-input::placeholder { color: #475569; }
        .login-input:focus { border-color: #e8b820 !important; box-shadow: 0 0 0 3px rgba(232,184,32,0.18) !important; }
        .login-btn:not(:disabled):hover { transform: translateY(-2px); box-shadow: 0 10px 32px rgba(232,184,32,0.45) !important; }
        .login-btn:not(:disabled):active { transform: translateY(0); }
        .register-link:hover { color: #fde68a !important; }
      `}</style>

      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", backgroundColor: "#060d1f", backgroundImage: `radial-gradient(ellipse 80% 50% at 50% -10%, rgba(22,48,96,0.9) 0%, transparent 70%), linear-gradient(rgba(245,200,66,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(245,200,66,0.035) 1px, transparent 1px)`, backgroundSize: "100% 100%, 56px 56px, 56px 56px" }}>
        <div style={{ width: "100%", maxWidth: "420px", animation: "fadeUp 0.65s cubic-bezier(0.16,1,0.3,1) both" }}>

          {/* Language switcher top-right */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
            <LanguageSwitcher />
          </div>

          {/* Brand header */}
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <img src="/logo.png" alt="IIT" style={{ height: "120px", width: "auto", display: "block", margin: "0 auto 16px", borderRadius: "12px" }} />
            <p style={{ marginTop: "4px", fontSize: "13px", color: "#64748b" }}>
              {t("auth.portalSubtitle")}
            </p>
          </div>

          {/* Glass card */}
          <div style={{ padding: "40px 36px", borderRadius: "24px", background: "rgba(10, 20, 42, 0.78)", border: "1px solid rgba(245,200,66,0.16)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)", boxShadow: "0 40px 100px rgba(0,0,0,0.6), 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)" }}>

            <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "21px", fontWeight: 500, color: "#f8fafc", margin: "0 0 32px 0" }}>
              {t("auth.login.title")}
            </h2>

            {error && (
              <div style={{ marginBottom: "24px", padding: "12px 16px", borderRadius: "12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.28)", fontSize: "13px", color: "#fca5a5" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "22px" }}>
                <label style={{ display: "block", fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#64748b", marginBottom: "10px" }}>
                  {t("auth.login.email")}
                </label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@example.com" required className="login-input" style={inputStyle}/>
              </div>

              <div style={{ marginBottom: "32px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:"10px" }}>
                  <label style={{ display: "block", fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#64748b" }}>
                    {t("auth.login.password")}
                  </label>
                  <Link href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`} style={{ fontSize:"12px", color:"#64748b", textDecoration:"none", transition:"color 0.15s" }}
                    onMouseOver={e=>(e.currentTarget.style.color="#f5c842")}
                    onMouseOut={e=>(e.currentTarget.style.color="#64748b")}>
                    Mot de passe oublié ?
                  </Link>
                </div>
                <input type="password" value={motDePasse} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required className="login-input" style={inputStyle}/>
              </div>

              <button type="submit" disabled={loading} className="login-btn" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", width: "100%", padding: "15px 24px", borderRadius: "14px", border: "none", cursor: loading ? "not-allowed" : "pointer", fontSize: "14px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#060d1f", background: loading ? "rgba(232,184,32,0.4)" : "linear-gradient(135deg, #f5c842 0%, #e8a820 100%)", boxShadow: loading ? "none" : "0 6px 24px rgba(232,184,32,0.35)", transition: "transform 0.18s ease, box-shadow 0.18s ease", fontFamily: "inherit" }}>
                {loading ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10" stroke="#060d1f" strokeWidth="3" strokeOpacity="0.3"/>
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="#060d1f" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                    {t("auth.login.loading")}
                  </>
                ) : t("auth.login.submit")}
              </button>
            </form>

            <div style={{ marginTop: "28px", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,0.07)", textAlign: "center", fontSize: "13px", color: "#475569" }}>
              {t("auth.login.noAccount")}{" "}
              <Link href="/register" className="register-link" style={{ color: "#f5c842", fontWeight: 600, textDecoration: "none", transition: "color 0.15s" }}>
                {t("auth.login.createAccount")}
              </Link>
            </div>
          </div>

          <p style={{ marginTop: "28px", textAlign: "center", fontSize: "11px", color: "#1e293b" }}>
            {t("auth.login.restricted")}
          </p>
        </div>
      </div>
    </>
  )
}

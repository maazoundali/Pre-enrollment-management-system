"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const token        = searchParams.get("token") ?? ""

  const [validating, setValidating] = useState(true)
  const [tokenValid, setTokenValid]  = useState(false)
  const [tokenError, setTokenError]  = useState("")

  const [password, setPassword]   = useState("")
  const [confirm, setConfirm]     = useState("")
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState("")
  const [done, setDone]           = useState(false)

  // Validate token on mount
  useEffect(() => {
    if (!token) { setTokenError("Lien invalide — aucun token trouvé."); setValidating(false); return }
    fetch(`/api/auth/reset-password?token=${token}`)
      .then(r => r.json())
      .then(d => { setTokenValid(d.valid); if (!d.valid) setTokenError(d.error ?? "Lien invalide.") })
      .catch(() => setTokenError("Impossible de valider le lien."))
      .finally(() => setValidating(false))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (password !== confirm) { setError("Les mots de passe ne correspondent pas."); return }
    if (password.length < 8)  { setError("Le mot de passe doit contenir au moins 8 caractères."); return }
    setLoading(true)
    try {
      const res  = await fetch("/api/auth/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Erreur")
      setDone(true)
      setTimeout(() => router.push("/login"), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur")
    } finally { setLoading(false) }
  }

  const inp: React.CSSProperties = {
    display:"block", width:"100%", padding:"12px 16px", fontSize:"14px",
    color:"#f8fafc", background:"rgba(255,255,255,0.06)",
    border:"1px solid rgba(255,255,255,0.12)", borderRadius:"12px",
    outline:"none", boxSizing:"border-box", fontFamily:"inherit", transition:"border-color 0.2s",
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        .rp-input:focus { border-color:#e8b820!important; box-shadow:0 0 0 3px rgba(232,184,32,0.18)!important; }
        .rp-input::placeholder { color:#475569; }
        .rp-btn:not(:disabled):hover { transform:translateY(-2px); box-shadow:0 10px 32px rgba(232,184,32,0.45)!important; }
      `}</style>

      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px", backgroundColor:"#060d1f", backgroundImage:`radial-gradient(ellipse 80% 50% at 50% -10%,rgba(22,48,96,0.9) 0%,transparent 70%)` }}>
        <div style={{ width:"100%", maxWidth:"420px", animation:"fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both" }}>

          <div style={{ textAlign:"center", marginBottom:"32px" }}>
            <div style={{ background:"white", borderRadius:"14px", padding:"10px 24px", display:"inline-flex", marginBottom:"18px", boxShadow:"0 4px 24px rgba(0,0,0,0.18)" }}>
              <img src="/logo.png" alt="IIT" style={{ height:"52px", width:"auto", display:"block" }} />
            </div>
          </div>

          <div style={{ padding:"36px", borderRadius:"24px", background:"rgba(10,20,42,0.78)", border:"1px solid rgba(245,200,66,0.16)", backdropFilter:"blur(28px)", boxShadow:"0 40px 100px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)" }}>

            {validating ? (
              <div style={{ textAlign:"center", padding:"20px 0" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ animation:"spin 0.8s linear infinite", margin:"0 auto" }}><circle cx="12" cy="12" r="10" stroke="#f5c842" strokeWidth="2" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#f5c842" strokeWidth="2" strokeLinecap="round"/></svg>
                <p style={{ color:"#64748b", fontSize:"13px", marginTop:"12px" }}>Vérification du lien…</p>
              </div>

            ) : !tokenValid ? (
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:"40px", marginBottom:"16px" }}>🔗</div>
                <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"20px", fontWeight:500, color:"#f8fafc", margin:"0 0 12px" }}>Lien invalide</h2>
                <p style={{ fontSize:"13.5px", color:"#64748b", lineHeight:1.6, marginBottom:"24px" }}>{tokenError}</p>
                <Link href="/forgot-password" style={{ display:"inline-block", padding:"11px 24px", borderRadius:"12px", background:"linear-gradient(135deg,#f5c842,#e8a820)", color:"#060d1f", fontSize:"13px", fontWeight:700, textDecoration:"none" }}>
                  Faire une nouvelle demande
                </Link>
              </div>

            ) : done ? (
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:"40px", marginBottom:"16px" }}>✅</div>
                <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"20px", fontWeight:500, color:"#f8fafc", margin:"0 0 12px" }}>Mot de passe mis à jour</h2>
                <p style={{ fontSize:"13.5px", color:"#64748b", lineHeight:1.6 }}>
                  Votre mot de passe a été modifié avec succès.<br/>Redirection vers la connexion…
                </p>
              </div>

            ) : (
              <>
                <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"20px", fontWeight:500, color:"#f8fafc", margin:"0 0 8px" }}>
                  Nouveau mot de passe
                </h2>
                <p style={{ fontSize:"13px", color:"#64748b", marginBottom:"24px" }}>Choisissez un mot de passe sécurisé d'au moins 8 caractères.</p>

                {error && (
                  <div style={{ marginBottom:"16px", padding:"10px 14px", borderRadius:"10px", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", fontSize:"13px", color:"#fca5a5" }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div style={{ display:"flex", flexDirection:"column", gap:"18px", marginBottom:"24px" }}>
                    <div>
                      <label style={{ display:"block", fontSize:"10.5px", fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#64748b", marginBottom:"10px" }}>Nouveau mot de passe</label>
                      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={8} className="rp-input" style={inp}/>
                    </div>
                    <div>
                      <label style={{ display:"block", fontSize:"10.5px", fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:"#64748b", marginBottom:"10px" }}>Confirmer le mot de passe</label>
                      <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" required minLength={8} className="rp-input" style={inp}/>
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="rp-btn" style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"8px", width:"100%", padding:"14px 24px", borderRadius:"14px", border:"none", cursor:loading?"not-allowed":"pointer", fontSize:"14px", fontWeight:700, color:"#060d1f", background:loading?"rgba(232,184,32,0.4)":"linear-gradient(135deg,#f5c842,#e8a820)", boxShadow:loading?"none":"0 6px 24px rgba(232,184,32,0.35)", transition:"transform 0.18s,box-shadow 0.18s", fontFamily:"inherit" }}>
                    {loading ? (
                      <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation:"spin 0.8s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="#060d1f" strokeWidth="3" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#060d1f" strokeWidth="3" strokeLinecap="round"/></svg>Mise à jour…</>
                    ) : "Modifier mon mot de passe"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

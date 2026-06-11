"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"

export default function VerifyEmailPage() {
  const searchParams = useSearchParams()
  const token        = searchParams.get("token") ?? ""

  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState("")

  useEffect(() => {
    if (!token) { setError("Lien invalide — aucun token trouvé."); setLoading(false); return }
    fetch(`/api/auth/verify-email?token=${token}`)
      .then(r => r.json())
      .then(d => { setSuccess(Boolean(d.ok)); if (!d.ok) setError(d.error ?? "Lien invalide.") })
      .catch(() => setError("Impossible de vérifier ce lien."))
      .finally(() => setLoading(false))
  }, [token])

  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        .ve-link:hover { transform:translateY(-2px); box-shadow:0 10px 32px rgba(232,184,32,0.45)!important; }
      `}</style>

      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px", backgroundColor:"#060d1f", backgroundImage:`radial-gradient(ellipse 80% 50% at 50% -10%,rgba(22,48,96,0.9) 0%,transparent 70%)` }}>
        <div style={{ width:"100%", maxWidth:"420px", animation:"fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both" }}>

          <div style={{ textAlign:"center", marginBottom:"32px" }}>
            <div style={{ background:"white", borderRadius:"14px", padding:"10px 24px", display:"inline-flex", marginBottom:"18px", boxShadow:"0 4px 24px rgba(0,0,0,0.18)" }}>
              <img src="/logo.png" alt="IIT" style={{ height:"52px", width:"auto", display:"block" }} />
            </div>
          </div>

          <div style={{ padding:"36px", borderRadius:"24px", background:"rgba(10,20,42,0.78)", border:"1px solid rgba(245,200,66,0.16)", backdropFilter:"blur(28px)", boxShadow:"0 40px 100px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)" }}>

            {loading ? (
              <div style={{ textAlign:"center", padding:"20px 0" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ animation:"spin 0.8s linear infinite", margin:"0 auto" }}><circle cx="12" cy="12" r="10" stroke="#f5c842" strokeWidth="2" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#f5c842" strokeWidth="2" strokeLinecap="round"/></svg>
                <p style={{ color:"#64748b", fontSize:"13px", marginTop:"12px" }}>Confirmation de votre email…</p>
              </div>

            ) : success ? (
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:"40px", marginBottom:"16px" }}>✅</div>
                <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"20px", fontWeight:500, color:"#f8fafc", margin:"0 0 12px" }}>Email confirmé</h2>
                <p style={{ fontSize:"13.5px", color:"#64748b", lineHeight:1.6, marginBottom:"24px" }}>
                  Votre adresse email a bien été vérifiée. Votre compte est maintenant activé.
                </p>
                <Link href="/login" className="ve-link" style={{ display:"inline-block", padding:"11px 24px", borderRadius:"12px", background:"linear-gradient(135deg,#f5c842,#e8a820)", color:"#060d1f", fontSize:"13px", fontWeight:700, textDecoration:"none", transition:"transform 0.18s,box-shadow 0.18s" }}>
                  Aller à la connexion
                </Link>
              </div>

            ) : (
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:"40px", marginBottom:"16px" }}>🔗</div>
                <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"20px", fontWeight:500, color:"#f8fafc", margin:"0 0 12px" }}>Lien invalide</h2>
                <p style={{ fontSize:"13.5px", color:"#64748b", lineHeight:1.6, marginBottom:"24px" }}>{error}</p>
                <Link href="/login" className="ve-link" style={{ display:"inline-block", padding:"11px 24px", borderRadius:"12px", background:"linear-gradient(135deg,#f5c842,#e8a820)", color:"#060d1f", fontSize:"13px", fontWeight:700, textDecoration:"none", transition:"transform 0.18s,box-shadow 0.18s" }}>
                  Aller à la connexion
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

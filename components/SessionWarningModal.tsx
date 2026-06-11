"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n-context"

const WARN_BEFORE_MS = 5 * 60 * 1000   // show warning 5 min before expiry
const CHECK_INTERVAL = 30_000           // poll every 30 s

export default function SessionWarningModal() {
  const { sessionExpiresAt, refresh, logout } = useAuth()
  const { t } = useI18n()
  const [show, setShow]         = useState(false)
  const [remaining, setRemaining] = useState(0)
  const [renewing, setRenewing] = useState(false)

  useEffect(() => {
    if (!sessionExpiresAt) { setShow(false); return }

    function check() {
      const ms = sessionExpiresAt!.getTime() - Date.now()
      if (ms <= 0) {
        setShow(false)
        void logout()
        return
      }
      setRemaining(Math.ceil(ms / 1000))
      setShow(ms <= WARN_BEFORE_MS)
    }

    check()
    const id = setInterval(check, CHECK_INTERVAL)
    return () => clearInterval(id)
  }, [sessionExpiresAt, logout])

  if (!show) return null

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60

  async function handleRenew() {
    setRenewing(true)
    await refresh()   // /api/auth/me re-issues the cookie on the server side
    setShow(false)
    setRenewing(false)
  }

  return (
    <>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}} @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", backdropFilter:"blur(4px)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px", animation:"fadeIn 0.2s ease both" }}>
        <div style={{ width:"100%", maxWidth:"420px", borderRadius:"20px", background:"rgba(8,16,36,0.98)", border:"1px solid rgba(245,200,66,0.25)", boxShadow:"0 32px 80px rgba(0,0,0,0.7)", overflow:"hidden", animation:"slideUp 0.25s ease both" }}>
          {/* Gold accent */}
          <div style={{ height:"3px", background:"linear-gradient(90deg,#f5c842,transparent)" }}/>

          <div style={{ padding:"28px 28px 24px" }}>
            {/* Icon + title */}
            <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"14px" }}>
              <div style={{ width:"42px", height:"42px", borderRadius:"12px", background:"rgba(245,200,66,0.1)", border:"1px solid rgba(245,200,66,0.25)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, color:"#f5c842" }}>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
                </svg>
              </div>
              <div>
                <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"17px", fontWeight:600, color:"#f8fafc", margin:0 }}>
                  {t("session.warningTitle")}
                </h2>
                <div style={{ fontSize:"12px", color:"#64748b", marginTop:"2px" }}>
                  {t("session.warningDesc")}
                </div>
              </div>
            </div>

            {/* Countdown */}
            <div style={{ padding:"14px 18px", borderRadius:"12px", background:"rgba(245,200,66,0.06)", border:"1px solid rgba(245,200,66,0.2)", marginBottom:"20px", textAlign:"center" }}>
              <div style={{ fontSize:"32px", fontWeight:700, color:"#f5c842", fontVariantNumeric:"tabular-nums" }}>
                {String(mins).padStart(2,"0")}:{String(secs).padStart(2,"0")}
              </div>
              <div style={{ fontSize:"12px", color:"#64748b", marginTop:"4px" }}>{t("session.remaining")}</div>
            </div>

            {/* Buttons */}
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={() => void logout()} style={{ flex:1, padding:"11px", borderRadius:"10px", border:"1px solid rgba(255,255,255,0.1)", background:"transparent", color:"#64748b", fontSize:"13px", cursor:"pointer", fontFamily:"inherit" }}>
                {t("session.logout")}
              </button>
              <button onClick={handleRenew} disabled={renewing} style={{ flex:2, padding:"11px", borderRadius:"10px", border:"none", background:renewing ? "rgba(245,200,66,0.4)" : "linear-gradient(135deg,#f5c842,#e8a820)", color:"#060d1f", fontSize:"13px", fontWeight:700, cursor:renewing ? "not-allowed" : "pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
                {renewing ? (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation:"spin 0.8s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="#060d1f" strokeWidth="3" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#060d1f" strokeWidth="3" strokeLinecap="round"/></svg>{t("common.loading")}</>
                ) : t("session.renew")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

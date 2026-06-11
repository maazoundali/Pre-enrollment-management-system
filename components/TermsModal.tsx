"use client"

import { useEffect } from "react"
import { useI18n } from "@/lib/i18n-context"

export default function TermsModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <>
      <style>{`@keyframes fadeIn { from{opacity:0} to{opacity:1} } @keyframes slideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }`}</style>
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(6px)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px", animation:"fadeIn 0.2s ease both" }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width:"100%", maxWidth:"560px", maxHeight:"80vh", borderRadius:"20px", background:"rgba(10,20,42,0.98)", border:"1px solid rgba(255,255,255,0.1)", boxShadow:"0 32px 80px rgba(0,0,0,0.7)", display:"flex", flexDirection:"column", animation:"slideUp 0.25s ease both" }}>
          {/* Header */}
          <div style={{ padding:"24px 28px 20px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
            <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"18px", fontWeight:600, color:"#f8fafc", margin:0 }}>
              {t("terms.title")}
            </h2>
            <button onClick={onClose} style={{ width:"30px", height:"30px", borderRadius:"8px", border:"none", background:"rgba(255,255,255,0.06)", color:"#94a3b8", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"inherit", fontSize:"18px" }}>×</button>
          </div>

          {/* Body */}
          <div style={{ padding:"24px 28px", overflowY:"auto", flex:1 }}>
            {[
              { title: t("terms.s1.title"), body: t("terms.s1.body") },
              { title: t("terms.s2.title"), body: t("terms.s2.body") },
              { title: t("terms.s3.title"), body: t("terms.s3.body") },
              { title: t("terms.s4.title"), body: t("terms.s4.body") },
              { title: t("terms.s5.title"), body: t("terms.s5.body") },
            ].map(({ title, body }) => (
              <div key={title} style={{ marginBottom:"20px" }}>
                <h3 style={{ fontSize:"13px", fontWeight:700, color:"#f5c842", marginBottom:"8px" }}>{title}</h3>
                <p style={{ fontSize:"13px", color:"#94a3b8", lineHeight:1.75, margin:0 }}>{body}</p>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ padding:"16px 28px", borderTop:"1px solid rgba(255,255,255,0.07)", flexShrink:0 }}>
            <button onClick={onClose} style={{ width:"100%", padding:"12px", borderRadius:"12px", border:"none", background:"linear-gradient(135deg,#f5c842,#e8a820)", color:"#060d1f", fontSize:"13px", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              {t("terms.close")}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

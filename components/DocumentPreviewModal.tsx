"use client"

import { useEffect } from "react"
import { useI18n } from "@/lib/i18n-context"

interface Props {
  url:  string
  nom:  string
  type: string  // e.g. "CNI", "DIPLOME", "PHOTO"
  onClose: () => void
}

function isImage(nom: string, url: string) {
  const ext = (nom.split(".").pop() ?? url.split(".").pop() ?? "").toLowerCase()
  return ["jpg","jpeg","png","webp","gif","bmp"].includes(ext)
}

export default function DocumentPreviewModal({ url, nom, type, onClose }: Props) {
  const { t } = useI18n()

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const img = isImage(nom, url)

  return (
    <>
      <style>{`
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Overlay */}
      <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", backdropFilter:"blur(8px)", zIndex:300, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-start", padding:"24px", animation:"fadeIn 0.2s ease both", overflowY:"auto" }}>

        {/* Header bar */}
        <div onClick={(e) => e.stopPropagation()} style={{ width:"100%", maxWidth:"900px", display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px", animation:"slideUp 0.25s ease both" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <span style={{ padding:"3px 10px", borderRadius:"20px", background:"rgba(245,200,66,0.12)", color:"#f5c842", fontSize:"11px", fontWeight:700 }}>{type}</span>
            <span style={{ fontSize:"13px", color:"#94a3b8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"300px" }}>{nom}</span>
          </div>
          <div style={{ display:"flex", gap:"8px" }}>
            <a href={url} target="_blank" rel="noreferrer" style={{ padding:"7px 14px", borderRadius:"9px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"#94a3b8", fontSize:"12px", textDecoration:"none", display:"flex", alignItems:"center", gap:"5px" }}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg>
              {t("common.openTab")}
            </a>
            <button onClick={onClose} style={{ padding:"7px 14px", borderRadius:"9px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"#94a3b8", fontSize:"12px", cursor:"pointer", fontFamily:"inherit" }}>
              ✕ {t("common.close")}
            </button>
          </div>
        </div>

        {/* Content */}
        <div onClick={(e) => e.stopPropagation()} style={{ width:"100%", maxWidth:"900px", borderRadius:"16px", overflow:"hidden", background:"rgba(10,20,42,0.9)", border:"1px solid rgba(255,255,255,0.08)", animation:"slideUp 0.25s ease both", minHeight:"500px", display:"flex", alignItems:"center", justifyContent:"center" }}>
          {img ? (
            <img src={url} alt={nom} style={{ maxWidth:"100%", maxHeight:"80vh", objectFit:"contain", display:"block" }}/>
          ) : (
            <iframe src={url} title={nom} style={{ width:"100%", height:"80vh", border:"none", display:"block" }}/>
          )}
        </div>
      </div>
    </>
  )
}

"use client"

import { useEffect, useState } from "react"

interface Props {
  message?: string
}

export default function IITLoadingModal({ message = "Chargement…" }: Props) {
  const [dots, setDots] = useState(1)
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d % 3) + 1), 500)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(6,13,31,0.92)",
      backdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <style>{`
        @keyframes iit-spin   { to { transform: rotate(360deg); } }
        @keyframes iit-pulse  { 0%,100% { opacity:0.6; transform:scale(1); } 50% { opacity:1; transform:scale(1.04); } }
        @keyframes iit-fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes iit-ring1  { to { transform: rotate(360deg); } }
        @keyframes iit-ring2  { to { transform: rotate(-360deg); } }
      `}</style>

      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: "28px",
        animation: "iit-fadeUp 0.5s ease both",
      }}>
        {/* Logo mark */}
        <div style={{ position: "relative", width: "110px", height: "110px" }}>
          {/* Outer rotating ring */}
          <svg width="110" height="110" viewBox="0 0 110 110" fill="none"
            style={{ position:"absolute", inset:0, animation:"iit-ring1 3s linear infinite" }}>
            <circle cx="55" cy="55" r="50" stroke="rgba(245,200,66,0.18)" strokeWidth="2"/>
            <circle cx="55" cy="55" r="50" stroke="#f5c842" strokeWidth="2"
              strokeLinecap="round" strokeDasharray="40 275"/>
          </svg>
          {/* Inner counter-rotating ring */}
          <svg width="110" height="110" viewBox="0 0 110 110" fill="none"
            style={{ position:"absolute", inset:0, animation:"iit-ring2 2s linear infinite" }}>
            <circle cx="55" cy="55" r="38" stroke="rgba(245,200,66,0.08)" strokeWidth="1.5"/>
            <circle cx="55" cy="55" r="38" stroke="rgba(245,200,66,0.4)" strokeWidth="1.5"
              strokeLinecap="round" strokeDasharray="18 220"/>
          </svg>

          {/* Centre: IIT badge */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: "2px",
          }}>
            <div style={{
              width: "64px", height: "96px", borderRadius: "18px",
              background: "linear-gradient(135deg, rgba(245,200,66,0.15) 0%, rgba(10,20,42,0.9) 100%)",
              border: "1px solid rgba(245,200,66,0.35)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 32px rgba(245,200,66,0.15)",
              animation: "iit-pulse 2.4s ease-in-out infinite",
            }}>
              {/* University graduation cap SVG */}
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#f5c842" strokeWidth="1.4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"/>
              </svg>
            </div>
          </div>
        </div>

        {/* University name */}
        <div style={{ textAlign: "center" }}>
          <img src="/logo.png" alt="IIT" style={{ height: "96px", width: "auto", display: "block", margin: "0 auto", borderRadius: "10px" }} />
        </div>

        {/* Loading message */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
        }}>
          <div style={{ fontSize: "14px", color: "#94a3b8", fontWeight: 500 }}>
            {message}{".".repeat(dots)}
          </div>
          {/* Progress dots */}
          <div style={{ display: "flex", gap: "6px" }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: "6px", height: "6px", borderRadius: "50%",
                background: "#f5c842",
                animation: `iit-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}/>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

// components/ConfirmModal.tsx
// Reusable confirmation modal — replaces browser confirm() everywhere.

import { useEffect, useRef } from "react"

interface Props {
  open:        boolean
  title:       string
  message:     string
  confirmLabel?: string
  cancelLabel?:  string
  variant?:    "danger" | "warning" | "success"
  loading?:    boolean
  onConfirm:   () => void
  onCancel:    () => void
}

const VARIANT = {
  danger:  { icon: "🗑", color: "#f87171", bg: "rgba(248,113,113,0.1)",  border: "rgba(248,113,113,0.25)",  btn: "linear-gradient(135deg,#f87171,#ef4444)", btnText: "#fff" },
  warning: { icon: "⚠️", color: "#f5c842", bg: "rgba(245,200,66,0.08)",  border: "rgba(245,200,66,0.2)",   btn: "linear-gradient(135deg,#f5c842,#e8a820)", btnText: "#060d1f" },
  success: { icon: "✅", color: "#4ade80", bg: "rgba(74,222,128,0.08)",  border: "rgba(74,222,128,0.2)",   btn: "linear-gradient(135deg,#4ade80,#22c55e)", btnText: "#060d1f" },
}

export default function ConfirmModal({
  open, title, message,
  confirmLabel = "Confirmer",
  cancelLabel  = "Annuler",
  variant = "warning",
  loading = false,
  onConfirm, onCancel,
}: Props) {

  const cancelRef = useRef<HTMLButtonElement>(null)

  // Close on Escape; focus cancel button on open
  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancel() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onCancel])

  if (!open) return null

  const v = VARIANT[variant]

  return (
    <>
      <style>{`
        @keyframes modalIn  { from { opacity:0; transform:scale(0.95) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes overlayIn{ from { opacity:0; } to { opacity:1; } }
        @keyframes spin     { to { transform:rotate(360deg); } }
      `}</style>

      {/* Overlay */}
      <div
        role="presentation"
        onClick={onCancel}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", animation: "overlayIn 0.18s ease both" }}
      >
        {/* Modal — stop propagation so clicking inside doesn't close */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          aria-describedby="confirm-modal-desc"
          onClick={(e) => e.stopPropagation()}
          style={{ width: "100%", maxWidth: "400px", borderRadius: "20px", background: "rgba(8,16,36,0.98)", border: `1px solid ${v.border}`, boxShadow: `0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)`, animation: "modalIn 0.22s cubic-bezier(0.16,1,0.3,1) both", overflow: "hidden" }}
        >
          {/* Top accent bar */}
          <div style={{ height: "3px", background: `linear-gradient(90deg, ${v.color}, transparent)` }}/>

          <div style={{ padding: "28px 28px 24px" }}>
            {/* Icon + title */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: v.bg, border: `1px solid ${v.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>
                {v.icon}
              </div>
              <h2 id="confirm-modal-title" style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: "18px", fontWeight: 600, color: "#f8fafc", margin: 0 }}>
                {title}
              </h2>
            </div>

            {/* Message */}
            <p id="confirm-modal-desc" style={{ fontSize: "13.5px", color: "#94a3b8", margin: "0 0 24px", lineHeight: 1.65 }}>
              {message}
            </p>

            {/* Buttons */}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                ref={cancelRef}
                onClick={onCancel}
                disabled={loading}
                aria-label={cancelLabel}
                style={{ padding: "10px 20px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#94a3b8", fontSize: "13px", fontWeight: 500, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
                onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; e.currentTarget.style.color = "#f8fafc" }}}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#94a3b8" }}
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                style={{ padding: "10px 22px", borderRadius: "10px", border: "none", background: loading ? "rgba(255,255,255,0.1)" : v.btn, color: loading ? "#64748b" : v.btnText, fontSize: "13px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "8px", transition: "all 0.15s", boxShadow: loading ? "none" : `0 4px 16px ${v.color}35` }}
              >
                {loading && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.8s linear infinite" }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                )}
                {loading ? "En cours…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
"use client"

import { useEffect, useState } from "react"

export interface TourStep {
  target: string   // CSS selector of the element to spotlight
  title: string
  body: string
}

interface Props {
  steps: TourStep[]
  storageKey: string   // localStorage flag — tour shows once per key
  labels: { step: string; skip: string; next: string; done: string }
}

function useTargetRect(selector: string | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!selector) { setRect(null); return }
    function update() {
      const el = document.querySelector(selector!)
      setRect(el ? el.getBoundingClientRect() : null)
    }
    update()
    window.addEventListener("resize", update)
    // Sidebar/cards can shift after async data loads — poll briefly to follow them
    const id = window.setInterval(update, 250)
    return () => { window.removeEventListener("resize", update); window.clearInterval(id) }
  }, [selector])

  return rect
}

export default function OnboardingTour({ steps, storageKey, labels }: Props) {
  const [open, setOpen] = useState(false)
  const [i, setI]       = useState(0)

  useEffect(() => {
    if (!localStorage.getItem(storageKey)) setOpen(true)
  }, [storageKey])

  const step = open ? steps[i] : undefined
  const rect = useTargetRect(step?.target ?? null)

  function finish() {
    localStorage.setItem(storageKey, "1")
    setOpen(false)
  }

  if (!step) return null

  const isLast = i === steps.length - 1
  const PAD = 8

  return (
    <>
      <style>{`@keyframes tourFade { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }`}</style>
      <div style={{ position: "fixed", inset: 0, zIndex: 400, pointerEvents: "none" }}>
        {rect ? (
          <div style={{
            position: "fixed",
            top: `${rect.top - PAD}px`, left: `${rect.left - PAD}px`,
            width: `${rect.width + PAD * 2}px`, height: `${rect.height + PAD * 2}px`,
            borderRadius: "14px", border: "2px solid #f5c842",
            boxShadow: "0 0 0 9999px rgba(3,7,18,0.8), 0 0 24px rgba(245,200,66,0.35)",
            transition: "all 0.3s cubic-bezier(0.16,1,0.3,1)",
          }}/>
        ) : (
          <div style={{ position: "fixed", inset: 0, background: "rgba(3,7,18,0.8)" }}/>
        )}

        <div style={{
          position: "fixed", bottom: "28px", insetInlineEnd: "28px",
          width: "min(300px, calc(100vw - 32px))", borderRadius: "18px",
          background: "rgba(10,20,42,0.98)", border: "1px solid rgba(245,200,66,0.25)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)", padding: "22px",
          pointerEvents: "auto", animation: "tourFade 0.25s ease both",
        }}>
          <div style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#f5c842", marginBottom: "10px" }}>
            {labels.step.replace("{n}", String(i + 1)).replace("{total}", String(steps.length))}
          </div>
          <h3 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: "15px", fontWeight: 600, color: "#f8fafc", margin: "0 0 8px" }}>
            {step.title}
          </h3>
          <p style={{ fontSize: "12.5px", color: "#94a3b8", lineHeight: 1.65, margin: "0 0 20px" }}>
            {step.body}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={finish} style={{ background: "none", border: "none", color: "#64748b", fontSize: "12px", cursor: "pointer", fontFamily: "inherit", padding: "6px 2px" }}>
              {labels.skip}
            </button>
            <button onClick={() => isLast ? finish() : setI((v) => v + 1)} style={{ padding: "9px 20px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg,#f5c842,#e8a820)", color: "#060d1f", fontSize: "12.5px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {isLast ? labels.done : labels.next}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

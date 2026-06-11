"use client"

// Thin gold loading bar at the top of the screen during route transitions.
// Uses next/navigation to detect when navigation starts and ends.

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

export default function RouteLoadingBar() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    setVisible(true)
    setWidth(30)
    const t1 = setTimeout(() => setWidth(70), 100)
    const t2 = setTimeout(() => setWidth(90), 400)
    const t3 = setTimeout(() => { setWidth(100) }, 700)
    const t4 = setTimeout(() => { setVisible(false); setWidth(0) }, 900)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [pathname])

  if (!visible) return null

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, height: "2px",
      zIndex: 9998, pointerEvents: "none",
    }}>
      <div style={{
        height: "100%",
        width: `${width}%`,
        background: "linear-gradient(90deg, #f5c842, #e8a820)",
        boxShadow: "0 0 8px rgba(245,200,66,0.6)",
        transition: "width 0.3s ease",
        borderRadius: "0 2px 2px 0",
      }}/>
    </div>
  )
}

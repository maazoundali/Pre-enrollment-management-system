"use client"

import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n-context"
import { usePathname, useRouter } from "next/navigation"
import { useEffect } from "react"
import Link from "next/link"
import LanguageSwitcher from "@/components/LanguageSwitcher"

export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const { t, dir } = useI18n()
  const router   = useRouter()
  const pathname = usePathname()

  const NAV = [
    {
      href: "/supervisor/dashboard", label: t("supervisor.layout.dashboard"),
      icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" /></svg>,
    },
    {
      href: "/supervisor/dossiers", label: t("supervisor.layout.dossiers"),
      icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v8.25A2.25 2.25 0 0 0 4.5 16.5h15a2.25 2.25 0 0 0 2.25-2.25V10.5a2.25 2.25 0 0 0-2.25-2.25h-7.06Z" /></svg>,
    },
    {
      href: "/supervisor/rapports", label: t("supervisor.layout.rapports"),
      icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>,
    },
  ]

  useEffect(() => {
    if (!loading && (!user || user.role !== "SUPERVISEUR")) router.push("/login")
  }, [user, loading, router])

  if (loading || !user) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#060d1f" }}>
      <div style={{ width: "36px", height: "36px", borderRadius: "50%", border: "2px solid rgba(245,200,66,0.2)", borderTopColor: "#f5c842", animation: "spin 0.8s linear infinite" }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const initials = [user.prenom?.[0], user.nom?.[0]].filter(Boolean).join("").toUpperCase() || "S"
  const fullName = [user.prenom, user.nom].filter(Boolean).join(" ") || user.email

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .snav-link:hover { background: rgba(255,255,255,0.06) !important; color: #f8fafc !important; }
        .slogout:hover { background: rgba(239,68,68,0.1) !important; color: #fca5a5 !important; }
      `}</style>

      <div dir={dir} style={{ display: "flex", minHeight: "100vh", background: "#070e20" }}>

        <aside style={{ width: "240px", flexShrink: 0, display: "flex", flexDirection: "column", background: "rgba(6,13,31,0.98)", borderInlineEnd: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>

          <div style={{ padding: "18px 16px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
            <img src="/logo.png" alt="IIT" style={{ height: "96px", width: "auto", display: "block", borderRadius: "8px" }} />
            <div style={{ fontSize: "10px", color: "#a78bfa", marginTop: "8px", fontWeight: 600 }}>{t("supervisor.layout.supervisorSpace")}</div>
          </div>

          <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto", minHeight: 0 }}>
            {NAV.map((item) => {
              const active = pathname === item.href || (item.href !== "/supervisor/dashboard" && pathname.startsWith(item.href))
              return (
                <Link key={item.href} href={item.href} className="snav-link" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", textDecoration: "none", fontSize: "13.5px", fontWeight: active ? 600 : 400, color: active ? "#f5c842" : "#94a3b8", background: active ? "rgba(245,200,66,0.1)" : "transparent", borderInlineStart: active ? "2px solid #f5c842" : "2px solid transparent", transition: "all 0.15s" }}>
                  <span style={{ color: active ? "#f5c842" : "#475569", flexShrink: 0 }}>{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div style={{ padding: "16px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
            <div style={{ marginBottom: "10px" }}>
              <LanguageSwitcher />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", marginBottom: "6px" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "linear-gradient(135deg,#4c1d95,#2e1065)", border: "1px solid rgba(167,139,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "#a78bfa", flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#f8fafc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fullName}</div>
                <div style={{ fontSize: "10.5px", color: "#a78bfa" }}>{t("supervisor.layout.supervisorRole")}</div>
              </div>
            </div>
            <button onClick={logout} className="slogout" style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "9px 12px", borderRadius: "10px", border: "none", background: "transparent", color: "#64748b", fontSize: "13px", cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit" }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" /></svg>
              {t("supervisor.layout.logout")}
            </button>
          </div>
        </aside>

        <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>{children}</main>
      </div>
    </>
  )
}

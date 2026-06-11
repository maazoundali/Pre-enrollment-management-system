"use client"

import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n-context"
import { useIsMobile } from "@/lib/use-mobile"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import LanguageSwitcher from "@/components/LanguageSwitcher"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const { t, dir } = useI18n()
  const isMobile = useIsMobile()
  const router   = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)


  const NAV = [
    {
      href: "/admin/dashboard", label: t("nav.admin.dashboard"),
      icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" /></svg>,
    },
    {
      href: "/admin/dossiers", label: t("nav.admin.dossiers"),
      icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" /></svg>,
    },
    {
      href: "/admin/filieres", label: t("nav.admin.filieres"),
      icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" /></svg>,
    },
    {
      href: "/admin/annees", label: t("nav.admin.annees"),
      icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" /></svg>,
    },
    {
      href: "/admin/parametres", label: t("nav.admin.parametres"),
      icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>,
    },
  ]

  useEffect(() => {
    if (!loading && (!user || user.role !== "ADMINISTRATEUR")) router.push("/login")
  }, [user, loading, router])

  if (loading || !user) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#060d1f" }}>
      <div style={{ width: "36px", height: "36px", borderRadius: "50%", border: "2px solid rgba(245,200,66,0.2)", borderTopColor: "#f5c842", animation: "spin 0.8s linear infinite" }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const initials = [user.prenom?.[0], user.nom?.[0]].filter(Boolean).join("").toUpperCase() || "A"
  const fullName = [user.prenom, user.nom].filter(Boolean).join(" ") || user.email

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .anav-link:hover { background: rgba(255,255,255,0.06) !important; color: #f8fafc !important; }
        .alogout:hover { background: rgba(239,68,68,0.1) !important; color: #fca5a5 !important; }
      `}</style>
      {isMobile && sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <div dir={dir} style={{ display: "flex", minHeight: "100vh", background: "#070e20" }}>

        {/* Sidebar */}
        <aside style={{
          width: "240px", flexShrink: 0, display: "flex", flexDirection: "column",
          background: "rgba(6,13,31,0.98)", borderInlineEnd: "1px solid rgba(255,255,255,0.06)",
          position: isMobile ? "fixed" : "sticky",
          top: 0, [dir === "rtl" ? "right" : "left"]: 0, height: "100vh", overflow: "hidden", zIndex: isMobile ? 100 : "auto",
          transform: isMobile && !sidebarOpen ? (dir === "rtl" ? "translateX(100%)" : "translateX(-100%)") : "translateX(0)",
          transition: "transform 0.25s ease",
        }}>

          {/* Logo */}
          <div style={{ padding: "18px 16px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
            <img src="/logo.png" alt="IIT" style={{ height: "96px", width: "auto", display: "block", borderRadius: "8px" }} />
            <div style={{ fontSize: "10px", color: "#f5c842", marginTop: "8px", fontWeight: 600 }}>{t("nav.adminSpace")}</div>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto", minHeight: 0 }}>
            {NAV.map((item) => {
              const active = pathname === item.href || (item.href !== "/admin/dashboard" && pathname.startsWith(item.href))
              return (
                <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} className="anav-link" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", textDecoration: "none", fontSize: "13.5px", fontWeight: active ? 600 : 400, color: active ? "#f5c842" : "#94a3b8", background: active ? "rgba(245,200,66,0.1)" : "transparent", borderInlineStart: active ? "2px solid #f5c842" : "2px solid transparent", transition: "all 0.15s" }}>
                  <span style={{ color: active ? "#f5c842" : "#475569", flexShrink: 0 }}>{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* User */}
          <div style={{ padding: "16px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
            {/* Language switcher */}
            <div style={{ marginBottom: "10px" }}>
              <LanguageSwitcher />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", marginBottom: "6px" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "linear-gradient(135deg,#1e4080,#0f2044)", border: "1px solid rgba(245,200,66,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "#f5c842", flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#f8fafc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fullName}</div>
                <div style={{ fontSize: "10.5px", color: "#f5c842" }}>{t("nav.adminRole")}</div>
              </div>
            </div>
            <button onClick={() => { setSidebarOpen(false); logout() }} className="alogout" style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "9px 12px", borderRadius: "10px", border: "none", background: "transparent", color: "#64748b", fontSize: "13px", cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit" }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" /></svg>
              {t("nav.logout")}
            </button>
          </div>
        </aside>

        <main style={{ flex: 1, minWidth: 0, overflowY: "auto", paddingTop: isMobile ? "56px" : 0 }}>
          {isMobile && (
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "56px", background: "rgba(6,13,31,0.98)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", zIndex: 90 }}>
              <button onClick={() => setSidebarOpen((o) => !o)} style={{ width: "38px", height: "38px", borderRadius: "10px", border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"/>
                </svg>
              </button>
              <img src="/logo.png" alt="IIT" style={{ height: "40px", width: "auto", display: "block", borderRadius: "6px" }} />
              <div style={{ width: "38px" }} />
            </div>
          )}
          {children}
        </main>
      </div>
    </>
  )
}

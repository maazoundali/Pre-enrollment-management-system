"use client"

import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n-context"
import { useIsMobile } from "@/lib/use-mobile"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import LanguageSwitcher from "@/components/LanguageSwitcher"

interface Notification {
  id: string; type: string; message: string; dateEnvoi: string; lu: boolean
}

interface DossierStatus {
  id: string; statut: string
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth()
  const { t, dir } = useI18n()
  const isMobile = useIsMobile()
  const router   = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread]               = useState(0)
  const [bellOpen, setBellOpen]           = useState(false)
  const [dossier, setDossier]             = useState<DossierStatus | null | undefined>(undefined)
  const bellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && (!user || user.role !== "ETUDIANT")) router.push("/login")
  }, [user, loading, router])

  // Fetch dossier status once on login — not on every navigation
  useEffect(() => {
    if (!user) return
    fetch("/api/dossiers?limit=1").then((r) => r.json()).catch(() => null).then((d) => {
      setDossier(d?.dossiers?.[0] ?? null)
    })
  }, [user])

  // Fetch notifications once on login, then poll every 60 s
  useEffect(() => {
    if (!user) return
    function loadNotifs() {
      fetch("/api/notifications").then((r) => r.json()).catch(() => null).then((d) => {
        if (!d) return
        setNotifications(d.notifications ?? [])
        setUnread(d.unreadCount ?? 0)
      })
    }
    loadNotifs()
    const id = setInterval(loadNotifs, 60_000)
    return () => clearInterval(id)
  }, [user])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [])

  async function markAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" })
    setNotifications((p) => p.map((n) => ({ ...n, lu: true })))
    setUnread(0)
  }

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" })
    setNotifications((p) => p.map((n) => n.id === id ? { ...n, lu: true } : n))
    setUnread((c) => Math.max(0, c - 1))
  }

  if (loading || !user) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#060d1f" }}>
      <div style={{ width: "36px", height: "36px", borderRadius: "50%", border: "2px solid rgba(245,200,66,0.2)", borderTopColor: "#f5c842", animation: "spin 0.8s linear infinite" }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const fullName = [user.prenom, user.nom].filter(Boolean).join(" ") || user.email
  const initials = [user.prenom?.[0], user.nom?.[0]].filter(Boolean).join("").toUpperCase() || "E"

  const hasDraft   = dossier?.statut === "BROUILLON"
  const isRejected = dossier?.statut === "REJETE"
  const hasActive  = dossier && dossier.statut !== "BROUILLON" && dossier.statut !== "REJETE"

  const NAV = [
    {
      href: "/student/dashboard",
      label: t("nav.student.dashboard"),
      icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" /></svg>,
    },
    // Pre-enrollment access is via the dashboard content, not the sidebar
    {
      href: "/student/filieres",
      label: t("nav.student.filieres"),
      icon: <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" /></svg>,
    },
  ]

  return (
    <>
      <style>{`
        @keyframes spin      { to { transform: rotate(360deg); } }
        @keyframes fadeIn    { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideIn    { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes slideInRtl { from { transform: translateX(100%);  } to { transform: translateX(0); } }
        .nav-link:hover      { background: rgba(255,255,255,0.06) !important; color: #f8fafc !important; }
        .logout-btn:hover    { background: rgba(239,68,68,0.1) !important; color: #fca5a5 !important; }
        .bell-item:hover     { background: rgba(255,255,255,0.06) !important; }
        .hamburger:hover     { background: rgba(255,255,255,0.08) !important; }
      `}</style>

      {/* Mobile overlay */}
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
            <div style={{ fontSize: "10px", color: "#475569", marginTop: "8px", fontWeight: 500 }}>{t("nav.studentSpace")}</div>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto", minHeight: 0 }}>
            {NAV.map((item) => {
              const active = pathname === item.href ||
                (item.href !== "/student/dashboard" && item.href !== "/student/filieres" && pathname.startsWith(item.href))
              return (
                <Link key={item.href} id={item.href === "/student/filieres" ? "tour-filieres-link" : undefined} href={item.href} onClick={() => setSidebarOpen(false)} className="nav-link" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", textDecoration: "none", fontSize: "13.5px", fontWeight: active ? 600 : 400, color: active ? "#f5c842" : "#94a3b8", background: active ? "rgba(245,200,66,0.1)" : "transparent", borderInlineStart: active ? "2px solid #f5c842" : "2px solid transparent", transition: "all 0.15s" }}>
                  <span style={{ color: active ? "#f5c842" : "#475569", flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ flex: 1, lineHeight: 1.3 }}>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Bottom: language + bell + user + logout */}
          <div style={{ padding: "16px 12px", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>

            {/* Language switcher */}
            <div style={{ marginBottom: "10px" }}>
              <LanguageSwitcher />
            </div>

            {/* Bell */}
            <div ref={bellRef} style={{ position: "relative", marginBottom: "6px" }}>
              <button
                id="tour-notif-bell"
                onClick={() => setBellOpen((o) => !o)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "10px", border: "none", background: bellOpen ? "rgba(245,200,66,0.08)" : "transparent", color: "#94a3b8", fontSize: "13px", cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit" }}
              >
                <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
                <span style={{ flex: 1 }}>{t("nav.notifications")}</span>
                {unread > 0 && (
                  <span style={{ background: "#f5c842", color: "#060d1f", fontSize: "10px", fontWeight: 700, padding: "1px 6px", borderRadius: "20px", minWidth: "18px", textAlign: "center", flexShrink: 0 }}>
                    {unread}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div style={{ position: "absolute", bottom: "calc(100% + 8px)", left: 0, right: 0, borderRadius: "14px", background: "rgba(8,16,36,0.98)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 16px 48px rgba(0,0,0,0.6)", overflow: "hidden", animation: "fadeIn 0.18s ease both", zIndex: 100 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#f8fafc" }}>{t("nav.notifications")}</span>
                    {unread > 0 && (
                      <button onClick={markAllRead} style={{ fontSize: "11px", color: "#f5c842", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                        {t("nav.markAllRead")}
                      </button>
                    )}
                  </div>
                  <div style={{ maxHeight: "260px", overflowY: "auto" }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: "24px 16px", textAlign: "center", fontSize: "13px", color: "#334155" }}>{t("nav.noNotification")}</div>
                    ) : notifications.slice(0, 8).map((n) => (
                      <div key={n.id} className="bell-item" onClick={() => !n.lu && markRead(n.id)} style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", cursor: n.lu ? "default" : "pointer", transition: "background 0.15s", display: "flex", gap: "10px", alignItems: "flex-start" }}>
                        {!n.lu && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f5c842", flexShrink: 0, marginTop: "5px" }}/>}
                        <div style={{ minWidth: 0, paddingInlineStart: n.lu ? "16px" : "0" }}>
                          <p style={{ fontSize: "12.5px", color: n.lu ? "#64748b" : "#e2e8f0", margin: 0, lineHeight: 1.5 }}>{n.message}</p>
                          <p style={{ fontSize: "10.5px", color: "#334155", margin: "4px 0 0" }}>
                            {new Date(n.dateEnvoi).toLocaleDateString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Avatar */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", marginBottom: "4px" }}>
              <div style={{ width: "34px", height: "34px", borderRadius: "50%", overflow: "hidden", border: "1px solid rgba(245,200,66,0.25)", flexShrink: 0, background: "linear-gradient(135deg,#1e4080,#0f2044)" }}>
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={initials} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}/>
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "#f5c842" }}>{initials}</div>
                )}
              </div>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#f8fafc", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fullName}</div>
                <div style={{ fontSize: "10.5px", color: "#475569" }}>{t("nav.studentRole")}</div>
              </div>
            </div>

            {/* Logout */}
            <button onClick={() => { setSidebarOpen(false); logout() }} className="logout-btn" style={{ width: "100%", display: "flex", alignItems: "center", gap: "8px", padding: "9px 12px", borderRadius: "10px", border: "none", background: "transparent", color: "#64748b", fontSize: "13px", cursor: "pointer", transition: "all 0.15s", fontFamily: "inherit" }}>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" /></svg>
              {t("nav.logout")}
            </button>
          </div>
        </aside>

        <main style={{ flex: 1, minWidth: 0, overflowY: "auto", paddingTop: isMobile ? "56px" : 0 }}>
          {/* Mobile top bar */}
          {isMobile && (
            <div dir={dir} style={{ position: "fixed", top: 0, left: 0, right: 0, height: "56px", background: "rgba(6,13,31,0.98)", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", zIndex: 90 }}>
              <button className="hamburger" onClick={() => setSidebarOpen((o) => !o)} style={{ width: "38px", height: "38px", borderRadius: "10px", border: "none", background: "transparent", color: "#94a3b8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}>
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

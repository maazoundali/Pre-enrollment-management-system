"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { useI18n } from "@/lib/i18n-context"
import LanguageSwitcher from "@/components/LanguageSwitcher"
import EnrollmentBanner from "@/components/EnrollmentBanner"

interface Filiere {
  id: string; nom: string; capacite: number; inscrits: number
  estComplete: boolean; tauxRemplissage: number
  description: string | null; duree: string | null
  diplomeDelivre: string | null; langue: string | null
  fraisInscription: number | null
}

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, visible }
}

const GOLD = "#f5c842"
const DARK = "#060d1f"

// ── SVG icons ──────────────────────────────────────────────────────────────────

const IconUser = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/>
  </svg>
)
const IconSearch = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/>
  </svg>
)
const IconFolder = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v8.25A2.25 2.25 0 0 0 4.5 16.5h15a2.25 2.25 0 0 0 2.25-2.25V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z"/>
  </svg>
)
const IconCpu = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z"/>
  </svg>
)
const IconCheck = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
  </svg>
)
const IconId = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z"/>
  </svg>
)
const IconDiploma = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 3.741-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"/>
  </svg>
)
const IconDoc = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>
  </svg>
)
const IconPhoto = () => (
  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"/>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"/>
  </svg>
)
const IconScan = () => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z"/>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75v-.75ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z"/>
  </svg>
)
const IconArrowRight = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"/>
  </svg>
)
const IconChevronDown = () => (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#475569" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7"/>
  </svg>
)

// ── Layout helpers ─────────────────────────────────────────────────────────────

function Section({ children, style, id }: { children: React.ReactNode; style?: React.CSSProperties; id?: string }) {
  return <section id={id} style={{ padding: "88px 24px", ...style }}>{children}</section>
}
function Container({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ maxWidth: "1100px", margin: "0 auto", ...style }}>{children}</div>
}
function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, visible } = useInView()
  return (
    <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)", transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms` }}>
      {children}
    </div>
  )
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
      <div style={{ height: "1px", width: "28px", background: GOLD }}/>
      <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: GOLD }}>{children}</span>
    </div>
  )
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: "clamp(26px,4vw,40px)", fontWeight: 600, color: "#f8fafc", margin: "0 0 14px", lineHeight: 1.2 }}>
      {children}
    </h2>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { t } = useI18n()
  const [filieres, setFilieres] = useState<Filiere[]>([])
  const [openFaq, setOpenFaq]   = useState<number | null>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    fetch("/api/filieres").then((r) => r.json()).then((d) => setFilieres(d.filieres ?? []))
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const available = filieres.filter((f) => !f.estComplete)

  const STEP_ICONS = [IconUser, IconSearch, IconFolder, IconCpu, IconCheck]
  const DOC_ICONS  = [IconId, IconDiploma, IconDoc, IconPhoto]

  const steps = Array.from({ length: 5 }, (_, i) => ({
    n: String(i + 1).padStart(2, "0"),
    Icon: STEP_ICONS[i],
    title: t(`landing.steps.${i}.title`),
    desc:  t(`landing.steps.${i}.desc`),
  }))

  const docs = Array.from({ length: 4 }, (_, i) => ({
    Icon: DOC_ICONS[i],
    label: t(`landing.docs.items.${i}.label`),
    desc:  t(`landing.docs.items.${i}.desc`),
  }))

  const faqItems = Array.from({ length: 5 }, (_, i) => ({
    q: t(`landing.faq.items.${i}.q`),
    a: t(`landing.faq.items.${i}.a`),
  }))

  return (
    <div style={{ minHeight: "100vh", background: DARK, color: "#f8fafc", fontFamily: "system-ui,-apple-system,sans-serif", overflowX: "hidden" }}>
      <style>{`
        @keyframes fadeUp  { from{opacity:0;transform:translateY(32px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes pulse   { 0%,100%{opacity:0.8} 50%{opacity:0.4} }
        *{box-sizing:border-box}
        .cta-p:hover { transform:translateY(-3px); box-shadow:0 12px 36px rgba(245,200,66,0.42) !important; }
        .cta-s:hover { background:rgba(255,255,255,0.1) !important; }
        .nl:hover    { color:#f5c842 !important; }
        .sc:hover    { border-color:rgba(245,200,66,0.28) !important; transform:translateY(-3px); }
        .fc:hover    { border-color:rgba(245,200,66,0.25) !important; transform:translateY(-2px); }
        .fq:hover    { background:rgba(255,255,255,0.03) !important; }
        .dr:hover    { background:rgba(255,255,255,0.03) !important; }
      `}</style>

      {/* ── Navbar ────────────────────────────────────────────────────────────── */}
      <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, padding:"0 32px", height:"80px", display:"flex", alignItems:"center", justifyContent:"space-between", background: scrolled ? "rgba(6,13,31,0.94)" : "transparent", backdropFilter: scrolled ? "blur(16px)" : "none", borderBottom: scrolled ? "1px solid rgba(255,255,255,0.07)" : "none", transition:"all 0.3s" }}>
        <div />
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          <LanguageSwitcher />
          <Link href="/login" className="nl" style={{ padding:"7px 16px", borderRadius:"8px", fontSize:"13px", color:"#94a3b8", textDecoration:"none", transition:"color 0.15s" }}>{t("landing.login")}</Link>
          <Link href="/register" className="cta-p" style={{ padding:"8px 18px", borderRadius:"9px", background:`linear-gradient(135deg,${GOLD},#e8a820)`, color:DARK, fontSize:"13px", fontWeight:700, textDecoration:"none", transition:"all 0.2s", boxShadow:"0 4px 14px rgba(245,200,66,0.28)" }}>
            {t("landing.register")}
          </Link>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"120px 24px 80px", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, backgroundImage:`radial-gradient(ellipse 80% 60% at 50% 0%, rgba(22,48,96,0.9) 0%, transparent 65%), linear-gradient(rgba(245,200,66,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(245,200,66,0.025) 1px, transparent 1px)`, backgroundSize:"100% 100%, 60px 60px, 60px 60px", pointerEvents:"none" }}/>
        <div style={{ position:"absolute", top:"18%", left:"7%", width:"320px", height:"320px", borderRadius:"50%", background:"radial-gradient(circle, rgba(245,200,66,0.05) 0%, transparent 70%)", animation:"float 8s ease-in-out infinite", pointerEvents:"none" }}/>
        <div style={{ position:"absolute", bottom:"12%", right:"5%", width:"220px", height:"220px", borderRadius:"50%", background:"radial-gradient(circle, rgba(96,165,250,0.06) 0%, transparent 70%)", animation:"float 10s ease-in-out infinite 2s", pointerEvents:"none" }}/>

        <div style={{ maxWidth:"740px", textAlign:"center", position:"relative", animation:"fadeUp 0.9s cubic-bezier(0.16,1,0.3,1) both" }}>
          {/* Logo in hero */}
          <div style={{ marginBottom:"32px" }}>
            <img src="/logo.png" alt="IIT" style={{ height:"140px", width:"auto", display:"block", margin:"0 auto", borderRadius:"14px" }} />
          </div>

          <div style={{ marginBottom:"28px" }}>
            <EnrollmentBanner variant="full" />
          </div>

          <h1 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"clamp(36px,6vw,66px)", fontWeight:700, color:"#f8fafc", margin:"0 0 22px", lineHeight:1.1, letterSpacing:"-0.02em" }}>
            {t("landing.heroTitle")}<br/>
            <span style={{ background:`linear-gradient(135deg,${GOLD},#e8a820)`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>{t("landing.heroHighlight")}</span>
          </h1>

          <p style={{ fontSize:"clamp(15px,2vw,18px)", color:"#8a9ab5", lineHeight:1.75, margin:"0 0 40px", maxWidth:"540px", marginLeft:"auto", marginRight:"auto" }}>
            {t("landing.heroDesc")}
          </p>

          <div style={{ display:"flex", gap:"12px", justifyContent:"center", flexWrap:"wrap" }}>
            <Link href="/register" className="cta-p" style={{ padding:"14px 32px", borderRadius:"13px", background:`linear-gradient(135deg,${GOLD},#e8a820)`, color:DARK, fontSize:"14px", fontWeight:700, textDecoration:"none", transition:"all 0.22s", boxShadow:"0 6px 24px rgba(245,200,66,0.32)", display:"inline-flex", alignItems:"center", gap:"8px" }}>
              {t("landing.startCta")} <IconArrowRight/>
            </Link>
            <Link href="/login" className="cta-s" style={{ padding:"14px 26px", borderRadius:"13px", border:"1px solid rgba(255,255,255,0.14)", background:"rgba(255,255,255,0.04)", color:"#f8fafc", fontSize:"14px", textDecoration:"none", transition:"all 0.2s" }}>
              {t("landing.alreadyAccount")}
            </Link>
          </div>

          <div style={{ display:"flex", gap:"52px", justifyContent:"center", marginTop:"64px", flexWrap:"wrap" }}>
            {[
              { value: available.length > 0 ? String(available.length) : "—", label: t("landing.stats.available") },
              { value: "100%",   label: t("landing.stats.online") },
              { value: "< 5 min", label: t("landing.stats.time") },
            ].map(({ value, label }) => (
              <div key={label} style={{ textAlign:"center" }}>
                <div style={{ fontSize:"26px", fontWeight:700, color:GOLD, fontFamily:"'Playfair Display',Georgia,serif" }}>{value}</div>
                <div style={{ fontSize:"12px", color:"#475569", marginTop:"4px" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────────── */}
      <Section id="process" style={{ background:"rgba(255,255,255,0.015)", borderTop:"1px solid rgba(255,255,255,0.06)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
        <Container>
          <FadeIn>
            <SectionLabel>{t("landing.howItWorks.label")}</SectionLabel>
            <SectionTitle>{t("landing.howItWorks.title")}</SectionTitle>
            <p style={{ fontSize:"15px", color:"#64748b", marginBottom:"52px", maxWidth:"460px", lineHeight:1.75 }}>
              {t("landing.howItWorks.desc")}
            </p>
          </FadeIn>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(196px, 1fr))", gap:"16px" }}>
            {steps.map((step, i) => (
              <FadeIn key={step.n} delay={i * 70}>
                <div className="sc" style={{ padding:"28px 22px", borderRadius:"18px", background:"rgba(10,20,42,0.7)", border:"1px solid rgba(255,255,255,0.07)", height:"100%", transition:"all 0.25s", position:"relative", overflow:"hidden" }}>
                  <div style={{ position:"absolute", top:"-8px", right:"14px", fontFamily:"'Playfair Display',Georgia,serif", fontSize:"68px", fontWeight:700, color:"rgba(245,200,66,0.12)", lineHeight:1, userSelect:"none", pointerEvents:"none" }}>
                    {step.n}
                  </div>
                  <div style={{ width:"38px", height:"38px", borderRadius:"10px", background:"rgba(245,200,66,0.08)", border:"1px solid rgba(245,200,66,0.18)", display:"flex", alignItems:"center", justifyContent:"center", color:GOLD, marginBottom:"16px" }}>
                    <step.Icon/>
                  </div>
                  <div style={{ fontSize:"13.5px", fontWeight:700, color:"#f8fafc", marginBottom:"10px", lineHeight:1.3 }}>{step.title}</div>
                  <div style={{ fontSize:"12.5px", color:"#64748b", lineHeight:1.7 }}>{step.desc}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </Container>
      </Section>

      {/* ── Filières ──────────────────────────────────────────────────────────── */}
      {filieres.length > 0 && (
        <Section>
          <Container>
            <FadeIn>
              <SectionLabel>{t("landing.programs.label")}</SectionLabel>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:"44px", flexWrap:"wrap", gap:"16px" }}>
                <div>
                  <SectionTitle>{t("landing.programs.title")}</SectionTitle>
                  <p style={{ fontSize:"14px", color:"#64748b", margin:0, maxWidth:"400px", lineHeight:1.75 }}>
                    {available.length} programme{available.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <Link href="/register" style={{ fontSize:"13px", color:GOLD, textDecoration:"none", fontWeight:600, display:"flex", alignItems:"center", gap:"6px", flexShrink:0 }}>
                  {t("landing.programs.viewAll")}
                </Link>
              </div>
            </FadeIn>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:"14px" }}>
              {filieres.slice(0, 6).map((f, i) => (
                  <FadeIn key={f.id} delay={i * 55}>
                    <div className="fc" style={{ padding:"22px 24px", borderRadius:"16px", background:"rgba(10,20,42,0.65)", border:"1px solid rgba(255,255,255,0.07)", transition:"all 0.22s", height:"100%", display:"flex", flexDirection:"column" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"8px" }}>
                        <h3 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"15px", fontWeight:600, color:"#f8fafc", margin:0, flex:1, marginRight:"8px" }}>{f.nom}</h3>
                        {f.estComplete && <span style={{ fontSize:"10px", padding:"2px 7px", borderRadius:"20px", background:"rgba(248,113,113,0.1)", color:"#f87171", fontWeight:600, flexShrink:0 }}>{t("student.filieres.full")}</span>}
                      </div>
                      {f.description && <p style={{ fontSize:"12.5px", color:"#64748b", lineHeight:1.6, marginBottom:"12px" }}>{f.description}</p>}
                      <div style={{ display:"flex", flexWrap:"wrap", gap:"5px" }}>
                        {f.diplomeDelivre  && <Chip label={f.diplomeDelivre} color="#f5c842"/>}
                        {f.duree           && <Chip label={f.duree} color="#60a5fa"/>}
                        {f.langue          && <Chip label={f.langue} color="#a78bfa"/>}
                        {f.fraisInscription != null && <Chip label={`${f.fraisInscription.toLocaleString()} DT/an`} color="#4ade80"/>}
                      </div>
                    </div>
                  </FadeIn>
                )
              )}
            </div>

            {filieres.length > 6 && (
              <FadeIn delay={180}>
                <div style={{ textAlign:"center", marginTop:"32px" }}>
                  <Link href="/register" style={{ display:"inline-flex", alignItems:"center", gap:"8px", padding:"11px 26px", borderRadius:"11px", border:`1px solid rgba(245,200,66,0.25)`, background:"rgba(245,200,66,0.05)", color:GOLD, fontSize:"13px", fontWeight:600, textDecoration:"none" }}>
                    +{filieres.length - 6} programme{filieres.length - 6 > 1 ? "s" : ""}
                  </Link>
                </div>
              </FadeIn>
            )}
          </Container>
        </Section>
      )}

      {/* ── Documents requis ──────────────────────────────────────────────────── */}
      <Section style={{ background:"rgba(255,255,255,0.015)", borderTop:"1px solid rgba(255,255,255,0.06)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
        <Container>
          <div className="grid-2col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"80px", alignItems:"center" }}>
            <FadeIn>
              <SectionLabel>{t("landing.docs.label")}</SectionLabel>
              <SectionTitle>{t("landing.docs.title")}</SectionTitle>
              <p style={{ fontSize:"14px", color:"#64748b", lineHeight:1.8, marginBottom:"30px" }}>
                {t("landing.docs.desc")}
              </p>
              <Link href="/register" className="cta-p" style={{ display:"inline-flex", alignItems:"center", gap:"8px", padding:"12px 26px", borderRadius:"11px", background:`linear-gradient(135deg,${GOLD},#e8a820)`, color:DARK, fontSize:"13px", fontWeight:700, textDecoration:"none", transition:"all 0.22s", boxShadow:"0 4px 16px rgba(245,200,66,0.28)" }}>
                {t("landing.docs.cta")}
              </Link>
            </FadeIn>

            <FadeIn delay={100}>
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                {docs.map((doc, i) => (
                  <div key={i} className="dr" style={{ display:"flex", alignItems:"center", gap:"14px", padding:"14px 16px", borderRadius:"12px", background:"rgba(10,20,42,0.55)", border:"1px solid rgba(255,255,255,0.07)", transition:"background 0.15s" }}>
                    <div style={{ width:"36px", height:"36px", borderRadius:"9px", background:"rgba(245,200,66,0.07)", border:"1px solid rgba(245,200,66,0.16)", display:"flex", alignItems:"center", justifyContent:"center", color:GOLD, flexShrink:0 }}>
                      <doc.Icon/>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:"13px", fontWeight:600, color:"#f8fafc", marginBottom:"2px" }}>{doc.label}</div>
                      <div style={{ fontSize:"11.5px", color:"#64748b" }}>{doc.desc}</div>
                    </div>
                    <div style={{ fontSize:"10px", padding:"2px 7px", borderRadius:"20px", background:"rgba(248,113,113,0.09)", color:"#f87171", fontWeight:600, flexShrink:0 }}>
                      {t("landing.docs.required")}
                    </div>
                  </div>
                ))}
              </div>
            </FadeIn>
          </div>
        </Container>
      </Section>

      {/* ── OCR feature ───────────────────────────────────────────────────────── */}
      <Section>
        <Container>
          <FadeIn>
            <div style={{ padding:"44px 48px", borderRadius:"22px", background:"linear-gradient(135deg, rgba(22,48,96,0.55) 0%, rgba(10,20,42,0.8) 100%)", border:`1px solid rgba(245,200,66,0.15)`, position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", top:0, right:0, width:"220px", height:"220px", background:"radial-gradient(circle at top right, rgba(245,200,66,0.06) 0%, transparent 70%)", pointerEvents:"none" }}/>
              <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:"48px", alignItems:"center" }}>
                <div>
                  <div style={{ display:"inline-flex", alignItems:"center", gap:"8px", padding:"4px 13px", borderRadius:"20px", background:"rgba(245,200,66,0.09)", border:"1px solid rgba(245,200,66,0.22)", marginBottom:"18px" }}>
                    <div style={{ color:GOLD, display:"flex" }}><IconScan/></div>
                    <span style={{ fontSize:"11px", color:GOLD, fontWeight:700, letterSpacing:"0.08em" }}>{t("landing.ocr.badge")}</span>
                  </div>
                  <h3 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"24px", fontWeight:600, color:"#f8fafc", margin:"0 0 12px" }}>
                    {t("landing.ocr.title")}
                  </h3>
                  <p style={{ fontSize:"13.5px", color:"#64748b", lineHeight:1.8, margin:"0 0 24px", maxWidth:"480px" }}>
                    {t("landing.ocr.desc")}
                  </p>
                  <div style={{ display:"flex", gap:"20px", flexWrap:"wrap" }}>
                    {Array.from({ length: 4 }, (_, i) => t(`landing.ocr.features.${i}`)).map((f) => (
                      <div key={f} style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:"12.5px", color:"#94a3b8" }}>
                        <div style={{ width:"4px", height:"4px", borderRadius:"50%", background:GOLD, flexShrink:0 }}/>{f}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:"8px", flexShrink:0 }}>
                  {[
                    { label: t("landing.ocr.scanCin.label"),      sub: t("landing.ocr.scanCin.sub") },
                    { label: t("landing.ocr.scanPassport.label"),  sub: t("landing.ocr.scanPassport.sub") },
                  ].map((item) => (
                    <div key={item.label} style={{ padding:"14px 18px", borderRadius:"12px", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", minWidth:"196px" }}>
                      <div style={{ fontSize:"13px", fontWeight:600, color:"#f8fafc", marginBottom:"3px" }}>{item.label}</div>
                      <div style={{ fontSize:"11px", color:"#475569" }}>{item.sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </FadeIn>
        </Container>
      </Section>

      {/* ── FAQ ───────────────────────────────────────────────────────────────── */}
      <Section style={{ background:"rgba(255,255,255,0.015)", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
        <Container>
          <FadeIn>
            <SectionLabel>{t("landing.faq.label")}</SectionLabel>
            <SectionTitle>{t("landing.faq.title")}</SectionTitle>
          </FadeIn>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginTop:"40px" }}>
            {faqItems.map((item, i) => (
              <FadeIn key={i} delay={i * 45}>
                <div className="fq" onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ padding:"18px 20px", borderRadius:"14px", background:"rgba(10,20,42,0.55)", border: openFaq === i ? `1px solid rgba(245,200,66,0.22)` : "1px solid rgba(255,255,255,0.07)", cursor:"pointer", transition:"all 0.2s" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"12px" }}>
                    <span style={{ fontSize:"13.5px", fontWeight:600, color: openFaq === i ? GOLD : "#e2e8f0", lineHeight:1.45 }}>{item.q}</span>
                    <div style={{ transition:"transform 0.2s", transform: openFaq === i ? "rotate(180deg)" : "rotate(0deg)", flexShrink:0, marginTop:"2px" }}><IconChevronDown/></div>
                  </div>
                  {openFaq === i && (
                    <div style={{ marginTop:"12px", paddingTop:"12px", borderTop:"1px solid rgba(255,255,255,0.06)", fontSize:"13px", color:"#64748b", lineHeight:1.75, animation:"fadeIn 0.2s ease both" }}>
                      {item.a}
                    </div>
                  )}
                </div>
              </FadeIn>
            ))}
          </div>
        </Container>
      </Section>

      {/* ── Final CTA ─────────────────────────────────────────────────────────── */}
      <Section>
        <Container>
          <FadeIn>
            <div style={{ textAlign:"center", padding:"64px 40px", borderRadius:"24px", background:"linear-gradient(135deg, rgba(22,48,96,0.65) 0%, rgba(10,20,42,0.9) 100%)", border:`1px solid rgba(245,200,66,0.13)`, position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(245,200,66,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(245,200,66,0.018) 1px, transparent 1px)", backgroundSize:"52px 52px", pointerEvents:"none" }}/>
              <div style={{ position:"relative" }}>
                <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"clamp(24px,4vw,38px)", fontWeight:600, color:"#f8fafc", margin:"0 0 14px" }}>
                  {t("landing.finalCta.title")}
                </h2>
                <p style={{ fontSize:"15px", color:"#64748b", maxWidth:"440px", margin:"0 auto 34px", lineHeight:1.75 }}>
                  {t("landing.finalCta.desc")}
                </p>
                <div style={{ display:"flex", gap:"12px", justifyContent:"center", flexWrap:"wrap" }}>
                  <Link href="/register" className="cta-p" style={{ padding:"14px 36px", borderRadius:"13px", background:`linear-gradient(135deg,${GOLD},#e8a820)`, color:DARK, fontSize:"14px", fontWeight:700, textDecoration:"none", transition:"all 0.22s", boxShadow:"0 6px 24px rgba(245,200,66,0.32)" }}>
                    {t("landing.finalCta.primary")}
                  </Link>
                  <Link href="/login" className="cta-s" style={{ padding:"14px 26px", borderRadius:"13px", border:"1px solid rgba(255,255,255,0.14)", background:"rgba(255,255,255,0.04)", color:"#f8fafc", fontSize:"14px", textDecoration:"none", transition:"all 0.2s" }}>
                    {t("landing.finalCta.secondary")}
                  </Link>
                </div>
              </div>
            </div>
          </FadeIn>
        </Container>
      </Section>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop:"1px solid rgba(255,255,255,0.06)", padding:"36px 24px" }}>
        <div style={{ display:"flex", flexDirection:"column", gap:"24px", maxWidth:"1100px", margin:"0 auto" }}>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"16px", textAlign:"center" }}>
            <img src="/footerLogo.png" alt="Institut International de Technologie" style={{ width:"206px", height:"auto", borderRadius:"16px" }} />
            <div style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"14px", fontWeight:600, color:"#f8fafc" }}></div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px", justifyItems:"center", alignItems:"start", color:"#94a3b8", fontSize:"13px" }}>
            <div style={{ minWidth:0 }}>
              <p style={{ margin:0, lineHeight:1.8 }}>Route de tunis km 10, Technopole El Ons, Sfax</p>
              <p style={{ margin:"10px 0 0", lineHeight:1.8 }}>Route Mharza km 1,5 Sfax, Tunisie</p>
            </div>
            <div style={{ minWidth:0 }}>
              <p style={{ margin:0, lineHeight:1.8 }}>(+216) 74 46 50 20</p>
              <p style={{ margin:"10px 0 0", lineHeight:1.8 }}>info@iit.tn</p>
            </div>
          </div>

          <p style={{ fontSize:"11px", color:"#334155", margin:0, textAlign:"center" }}>© {new Date().getFullYear()} — {t("landing.allRightsReserved")}</p>
        </div>
      </footer>
    </div>
  )
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize:"11px", padding:"2px 9px", borderRadius:"5px", background:`${color}10`, color, border:`1px solid ${color}20` }}>
      {label}
    </span>
  )
}

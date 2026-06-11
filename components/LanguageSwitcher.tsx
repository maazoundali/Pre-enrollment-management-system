"use client"

import { useI18n, type Locale } from "@/lib/i18n-context"

const LANGS: { code: Locale; label: string }[] = [
  { code: "fr", label: "FR" },
  { code: "en", label: "EN" },
  { code: "ar", label: "AR" },
]

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n()

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "2px",
      padding: "4px",
      borderRadius: "8px",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => setLocale(code)}
          style={{
            padding: "4px 8px",
            borderRadius: "5px",
            border: "none",
            background: locale === code ? "rgba(245,200,66,0.15)" : "transparent",
            color: locale === code ? "#f5c842" : "#475569",
            fontSize: "10.5px",
            fontWeight: locale === code ? 700 : 500,
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "all 0.15s",
            letterSpacing: "0.04em",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

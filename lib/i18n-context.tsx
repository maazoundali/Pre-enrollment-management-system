"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import fr from "@/dictionaries/fr"
import en from "@/dictionaries/en"
import ar from "@/dictionaries/ar"

export type Locale = "fr" | "en" | "ar"

const DICTS = { fr, en, ar }

type Dict = typeof fr

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
  dir: "ltr" | "rtl"
}

const I18nContext = createContext<I18nContextValue | null>(null)

function getVal(obj: unknown, keys: string[]): string | null {
  let cur = obj
  for (const k of keys) {
    if (typeof cur !== "object" || cur === null) return null
    cur = (cur as Record<string, unknown>)[k]
  }
  return typeof cur === "string" ? cur : null
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fr")

  useEffect(() => {
    try {
      const stored = localStorage.getItem("locale") as Locale | null
      if (stored && stored in DICTS) setLocaleState(stored)
    } catch { /* localStorage unavailable */ }
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr"
    try { localStorage.setItem("locale", locale) } catch { /* ignore */ }
  }, [locale])

  function setLocale(l: Locale) { setLocaleState(l) }

  function t(key: string, vars?: Record<string, string | number>): string {
    const dict: Dict = DICTS[locale]
    const val = getVal(dict, key.split(".")) ?? getVal(DICTS.fr, key.split(".")) ?? key
    if (!vars) return val
    return val.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dir: locale === "ar" ? "rtl" : "ltr" }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>")
  return ctx
}

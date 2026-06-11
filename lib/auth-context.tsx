"use client"

// lib/auth-context.tsx
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react"
import { useRouter } from "next/navigation"

export type Role = "ETUDIANT" | "ADMINISTRATEUR" | "SUPERVISEUR"

export interface CurrentUser {
  id:             string
  email:          string
  role:           Role
  nom:            string | null
  prenom:         string | null
  dateNaissance:  string | null
  typeIdentite:   string | null
  numeroIdentite: string | null
  sexe:           string | null
  adresse:        string | null
  pays:           string | null
  telephone:      string | null
  departement:    string | null
  niveauAcces:    number | null
  avatarUrl:      string | null
}

interface AuthContextValue {
  user:              CurrentUser | null
  loading:           boolean
  isProfileComplete: boolean
  sessionExpiresAt:  Date | null
  login:             (email: string, motDePasse: string) => Promise<void>
  logout:            () => Promise<void>
  refresh:           () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Profile is "complete" once the student has filled in their contact/ID details
// (nom+prenom are already collected at register, so we check for the ID number)
function checkProfileComplete(user: CurrentUser | null): boolean {
  if (!user) return false
  if (user.role !== "ETUDIANT") return true
  return Boolean(user.numeroIdentite || user.telephone || user.adresse)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]                     = useState<CurrentUser | null>(null)
  const [loading, setLoading]               = useState(true)
  const [sessionExpiresAt, setSessionExpiry] = useState<Date | null>(null)
  const router                               = useRouter()

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me")
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
        setSessionExpiry(data.sessionExpiresAt ? new Date(data.sessionExpiresAt) : null)
      } else {
        setUser(null)
        setSessionExpiry(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const login = useCallback(async (email: string, motDePasse: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, motDePasse }),
    })
    if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Login failed") }
    const data = await res.json()
    setUser(data.user)

    const redirectMap: Record<Role, string> = {
      ETUDIANT:       "/student/dashboard",
      ADMINISTRATEUR: "/admin/dashboard",
      SUPERVISEUR:    "/supervisor/dashboard",
    }
    router.push(redirectMap[data.user.role as Role])
  }, [router])

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    setUser(null)
    router.push("/login")
  }, [router])

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isProfileComplete: checkProfileComplete(user),
      sessionExpiresAt,
      login,
      logout,
      refresh,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}
"use client"

// app/unauthorized/page.tsx
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"

export default function UnauthorizedPage() {
  const { user } = useAuth()

  const homeMap: Record<string, string> = {
    ETUDIANT:       "/student/dashboard",
    ADMINISTRATEUR: "/admin/dashboard",
    SUPERVISEUR:    "/supervisor/dashboard",
  }

  const home = user ? homeMap[user.role] : "/login"

  return (
    <div className="auth-bg flex min-h-screen items-center justify-center p-4">
      <div className="relative z-10 w-full max-w-md text-center animate-fade-up">
        <div className="glass-card p-10">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10">
            <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-semibold text-white">Accès refusé</h1>
          <p className="mt-3 text-sm text-slate-400">
            Vous n&apos;avez pas les permissions nécessaires pour accéder à cette page.
          </p>
          <Link
            href={home}
            className="btn-gold mt-6 inline-block rounded-lg px-6 py-2.5 text-sm"
          >
            Retour à mon espace
          </Link>
        </div>
      </div>
    </div>
  )
}
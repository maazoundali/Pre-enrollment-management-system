// app/(auth)/layout.tsx
// Shared layout for login and register pages.
// Already-authenticated users get redirected to their dashboard.

import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (session) {
    const map = {
      ETUDIANT:       "/student/dashboard",
      ADMINISTRATEUR: "/admin/dashboard",
      SUPERVISEUR:    "/supervisor/dashboard",
    }
    redirect(map[session.role])
  }

  return <>{children}</>
}
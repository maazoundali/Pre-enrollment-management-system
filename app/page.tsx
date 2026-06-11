// app/page.tsx
// Authenticated users → their dashboard
// Unauthenticated → landing page
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import LandingPage from "@/components/LandingPage"

export default async function RootPage() {
  const session = await getSession()

  if (session) {
    const map: Record<string, string> = {
      ETUDIANT:       "/student/dashboard",
      ADMINISTRATEUR: "/admin/dashboard",
      SUPERVISEUR:    "/supervisor/dashboard",
    }
    redirect(map[session.role] ?? "/login")
  }

  return <LandingPage />
}
// app/api/auth/me/route.ts
import { NextResponse } from "next/server"
import { getSession, verifyToken } from "@/lib/auth"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 })
  }

  const user = await prisma.utilisateur.findUnique({
    where: { id: session.id },
    select: {
      id:            true,
      email:         true,
      role:          true,
      dateCreation:  true,

      // Identity
      nom:            true,
      prenom:         true,
      dateNaissance:  true,
      typeIdentite:   true,
      numeroIdentite: true,

      // Profile
      sexe:      true,
      adresse:   true,
      pays:      true,
      telephone: true,

      // Admin
      departement: true,

      // Supervisor
      niveauAcces: true,

      // Avatar (auto-set from PHOTO document upload)
      avatarUrl: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 })
  }

  // Expose session expiry so the client can show a timeout warning
  let sessionExpiresAt: string | null = null
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("auth_token")?.value
    if (token) {
      const { jwtVerify } = await import("jose")
      const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
      const { payload } = await jwtVerify(token, secret)
      if (payload.exp) sessionExpiresAt = new Date(payload.exp * 1000).toISOString()
    }
  } catch { /* ignore — best-effort */ }

  return NextResponse.json({ user, sessionExpiresAt })
}

// PATCH /api/auth/me — update student profile fields
export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      nom, prenom, dateNaissance,
      typeIdentite, numeroIdentite,
      sexe, adresse, pays, telephone,
    } = body

    // If changing identity number, check uniqueness
    if (numeroIdentite) {
      const conflict = await prisma.utilisateur.findFirst({
        where: { numeroIdentite, NOT: { id: session.id } },
      })
      if (conflict) {
        return NextResponse.json(
          { error: "Ce numéro d'identité est déjà utilisé." },
          { status: 409 }
        )
      }
    }

    const updated = await prisma.utilisateur.update({
      where: { id: session.id },
      data: {
        nom:            nom            ?? undefined,
        prenom:         prenom         ?? undefined,
        dateNaissance:  dateNaissance  ? new Date(dateNaissance) : undefined,
        typeIdentite:   typeIdentite   ?? undefined,
        numeroIdentite: numeroIdentite ?? undefined,
        sexe:           sexe           ?? undefined,
        adresse:        adresse        ?? undefined,
        pays:           pays           ?? undefined,
        telephone:      telephone      ?? undefined,
      },
      select: {
        id: true, email: true, role: true,
        nom: true, prenom: true, dateNaissance: true,
        typeIdentite: true, numeroIdentite: true,
        sexe: true, adresse: true, pays: true, telephone: true,
      },
    })

    return NextResponse.json({ user: updated })
  } catch (err) {
    console.error("[PATCH /api/auth/me]", err)
    return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 })
  }
}
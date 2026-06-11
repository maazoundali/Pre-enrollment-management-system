import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET — confirm the email using the token from the link sent at signup
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token")
  if (!token) return NextResponse.json({ ok: false, error: "Token manquant." })

  const verification = await prisma.emailVerification.findUnique({ where: { token } })

  if (!verification)                        return NextResponse.json({ ok: false, error: "Lien invalide." })
  if (verification.expiresAt < new Date())  return NextResponse.json({ ok: false, error: "Ce lien a expiré." })

  if (!verification.usedAt) {
    await prisma.$transaction([
      prisma.utilisateur.update({
        where: { id: verification.userId },
        data:  { emailVerifie: true },
      }),
      prisma.emailVerification.update({
        where: { id: verification.id },
        data:  { usedAt: new Date() },
      }),
    ])
  }

  return NextResponse.json({ ok: true })
}

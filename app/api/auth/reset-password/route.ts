import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

// 10 attempts per 15 minutes per IP
const LIMIT  = 10
const WINDOW = 15 * 60 * 1000

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers)
  if (!checkRateLimit(`reset:${ip}`, LIMIT, WINDOW)) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez dans 15 minutes." }, { status: 429 })
  }

  try {
    const { token, password } = await req.json() as { token?: string; password?: string }
    if (!token || !password) {
      return NextResponse.json({ error: "Token et mot de passe requis." }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Le mot de passe doit contenir au moins 8 caractères." }, { status: 400 })
    }

    const reset = await prisma.passwordReset.findUnique({
      where: { token },
      include: { user: { select: { id: true } } },
    })

    if (!reset)                          return NextResponse.json({ error: "Lien invalide." }, { status: 400 })
    if (reset.usedAt)                    return NextResponse.json({ error: "Ce lien a déjà été utilisé." }, { status: 400 })
    if (reset.expiresAt < new Date())    return NextResponse.json({ error: "Ce lien a expiré. Faites une nouvelle demande." }, { status: 400 })

    const hashed = await bcrypt.hash(password, 12)

    await prisma.$transaction([
      prisma.utilisateur.update({
        where: { id: reset.userId },
        data:  { motDePasse: hashed },
      }),
      prisma.passwordReset.update({
        where: { id: reset.id },
        data:  { usedAt: new Date() },
      }),
    ])

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[POST /api/auth/reset-password]", err)
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 })
  }
}

// GET — validate token (used by the reset page to check before showing the form)
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token")
  if (!token) return NextResponse.json({ valid: false, error: "Token manquant." })

  const reset = await prisma.passwordReset.findUnique({ where: { token } })
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
    return NextResponse.json({ valid: false, error: "Lien invalide ou expiré." })
  }
  return NextResponse.json({ valid: true })
}

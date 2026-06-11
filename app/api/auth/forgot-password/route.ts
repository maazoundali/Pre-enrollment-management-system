import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { sendPasswordResetEmail } from "@/lib/email"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

// 5 requests per 15 minutes per IP to prevent email flooding
const LIMIT  = 5
const WINDOW = 15 * 60 * 1000

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers)
  if (!checkRateLimit(`forgot:${ip}`, LIMIT, WINDOW)) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez dans 15 minutes." }, { status: 429 })
  }

  try {
    const { email } = await req.json() as { email?: string }
    if (!email) return NextResponse.json({ error: "Email requis." }, { status: 400 })

    // Always return the same response regardless of whether the email exists
    // (prevents user enumeration attacks)
    const user = await prisma.utilisateur.findUnique({ where: { email } })
    if (user) {
      // Delete any existing unused tokens for this user
      await prisma.passwordReset.deleteMany({
        where: { userId: user.id, usedAt: null },
      })

      const token     = randomBytes(32).toString("hex")
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000)  // 1 hour

      await prisma.passwordReset.create({
        data: { token, userId: user.id, expiresAt },
      })

      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`
      await sendPasswordResetEmail({ to: email, prenom: user.prenom, resetUrl })
    }

    // Always return success (don't reveal if email exists)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[POST /api/auth/forgot-password]", err)
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 })
  }
}

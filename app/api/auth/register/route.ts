// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { signToken, buildAuthCookie } from "@/lib/auth"
import { Role, Sexe } from "@prisma/client"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { sendEmailVerificationEmail } from "@/lib/email"

// 5 registrations per hour per IP
const REG_LIMIT  = 5
const REG_WINDOW = 60 * 60 * 1000

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers)
  if (!checkRateLimit(`register:${ip}`, REG_LIMIT, REG_WINDOW)) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans une heure." },
      { status: 429 }
    )
  }

  try {
    const { email, motDePasse, role = "ETUDIANT", nom, prenom, sexe, consentementRGPD } = await req.json()

    if (role === "ETUDIANT" && !consentementRGPD) {
      return NextResponse.json({ error: "Vous devez accepter les conditions d'utilisation." }, { status: 400 })
    }

    if (!email || !motDePasse) {
      return NextResponse.json({ error: "Email et mot de passe sont obligatoires." }, { status: 400 })
    }
    if (motDePasse.length < 6) {
      return NextResponse.json({ error: "Le mot de passe doit contenir au moins 6 caractères." }, { status: 400 })
    }

    const exists = await prisma.utilisateur.findUnique({ where: { email } })
    if (exists) {
      return NextResponse.json({ error: "Cet email est déjà utilisé." }, { status: 409 })
    }

    const hashed = await bcrypt.hash(motDePasse, 12)

    const user = await prisma.utilisateur.create({
      data: {
        email,
        motDePasse: hashed,
        role:   role as Role,
        nom:    nom    || null,
        prenom: prenom || null,
        sexe:   sexe   ? sexe as Sexe : null,
        consentementRGPD: Boolean(consentementRGPD),
      },
      select: {
        id: true, email: true, role: true,
        nom: true, prenom: true, sexe: true,
        typeIdentite: true, numeroIdentite: true,
        adresse: true, pays: true, telephone: true, dateNaissance: true,
      },
    })

    // Send a confirmation link (fake SMTP / Ethereal in dev — see lib/email.ts)
    const verifyToken   = randomBytes(32).toString("hex")
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)  // 24 hours
    await prisma.emailVerification.create({
      data: { token: verifyToken, userId: user.id, expiresAt: verifyExpires },
    })
    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify-email?token=${verifyToken}`
    void sendEmailVerificationEmail({ to: user.email, prenom: user.prenom, verifyUrl })

    const authToken = await signToken({ id: user.id, email: user.email, role: user.role })
    const response = NextResponse.json({ user }, { status: 201 })
    response.cookies.set(buildAuthCookie(authToken))
    return response
  } catch (err) {
    console.error("[POST /api/auth/register]", err)
    return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 })
  }
}
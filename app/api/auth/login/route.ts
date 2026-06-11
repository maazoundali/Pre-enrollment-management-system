// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { signToken, buildAuthCookie } from "@/lib/auth"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

// 10 attempts per 15 minutes per IP
const LOGIN_LIMIT  = 10
const LOGIN_WINDOW = 15 * 60 * 1000

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers)
  if (!checkRateLimit(`login:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW)) {
    return NextResponse.json(
      { error: "Trop de tentatives. Réessayez dans 15 minutes." },
      { status: 429 }
    )
  }

  try {
    const { email, motDePasse } = await req.json()

    if (!email || !motDePasse) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    const user = await prisma.utilisateur.findUnique({ where: { email } })
    const valid = user && (await bcrypt.compare(motDePasse, user.motDePasse))

    // Same error for "not found" and "wrong password" — prevents user enumeration
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const token = await signToken({ id: user.id, email: user.email, role: user.role })
    const response = NextResponse.json({
      user: {
        id:             user.id,
        email:          user.email,
        role:           user.role,
        nom:            user.nom,
        prenom:         user.prenom,
        dateNaissance:  user.dateNaissance,
        typeIdentite:   user.typeIdentite,
        numeroIdentite: user.numeroIdentite,
        sexe:           user.sexe,
        adresse:        user.adresse,
        pays:           user.pays,
        telephone:      user.telephone,
        departement:    user.departement,
        niveauAcces:    user.niveauAcces,
        avatarUrl:      user.avatarUrl,
      },
    })
    response.cookies.set(buildAuthCookie(token))
    return response
  } catch (err) {
    console.error("[POST /api/auth/login]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
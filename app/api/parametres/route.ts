// app/api/parametres/route.ts
// GET  — public, returns enrollment period settings
// PATCH — admin only, updates one or more settings

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

// ── GET /api/parametres ────────────────────────────────────────────────────────
export async function GET() {
  const rows = await prisma.parametreSysteme.findMany()
  const params: Record<string, string> = {}
  for (const r of rows) params[r.cle] = r.valeur
  const res = NextResponse.json({ params })
  res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120")
  return res
}

// ── PATCH /api/parametres ──────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== "ADMINISTRATEUR") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 })
  }

  try {
    const body = await req.json() as Record<string, string>
    await Promise.all(
      Object.entries(body).map(([cle, valeur]) =>
        prisma.parametreSysteme.upsert({
          where:  { cle },
          update: { valeur },
          create: { cle, valeur },
        })
      )
    )
    const rows = await prisma.parametreSysteme.findMany()
    const params: Record<string, string> = {}
    for (const r of rows) params[r.cle] = r.valeur
    return NextResponse.json({ params })
  } catch (err) {
    console.error("[PATCH /api/parametres]", err)
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 })
  }
}

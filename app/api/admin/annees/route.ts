// GET  /api/admin/annees — list all academic years with dossier counts
// POST /api/admin/annees — create a new year (auto-archives the current active one)

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET() {
  const session = await getSession()
  if (!session || session.role !== "ADMINISTRATEUR") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 })
  }

  const annees = await prisma.anneeAcademique.findMany({
    orderBy: { dateCreation: "desc" },
    include: {
      _count: { select: { dossiers: true } },
    },
  })

  return NextResponse.json({ annees })
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== "ADMINISTRATEUR") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 })
  }

  const body = await req.json() as {
    libelle:       string
    dateOuverture?: string | null
    dateFermeture?: string | null
  }

  const libelle = body.libelle?.trim()
  if (!libelle) {
    return NextResponse.json({ error: "Le libellé est obligatoire." }, { status: 400 })
  }

  // Validate date range if both provided
  if (body.dateOuverture && body.dateFermeture) {
    if (new Date(body.dateFermeture) <= new Date(body.dateOuverture)) {
      return NextResponse.json(
        { error: "La date de fermeture doit être après la date d'ouverture." },
        { status: 400 }
      )
    }
  }

  // Use a transaction: archive current active year + create new one atomically
  const newAnnee = await prisma.$transaction(async (tx) => {
    // Archive the current active year (if any)
    await tx.anneeAcademique.updateMany({
      where:  { active: true },
      data:   { active: false, archivee: true },
    })

    // Create and activate the new year
    return tx.anneeAcademique.create({
      data: {
        libelle,
        active:        true,
        archivee:      false,
        dateOuverture: body.dateOuverture ? new Date(body.dateOuverture) : null,
        dateFermeture: body.dateFermeture ? new Date(body.dateFermeture) : null,
      },
    })
  })

  return NextResponse.json({ annee: newAnnee }, { status: 201 })
}

// app/api/rapports/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

// ── GET /api/rapports ──────────────────────────────────────────────────────────
// Supervisor only — list all reports they generated.
export async function GET() {
  const session = await getSession()
  if (!session || session.role !== "SUPERVISEUR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const rapports = await prisma.rapport.findMany({
    where:   { superviseurId: session.id },
    orderBy: { dateGeneration: "desc" },
  })

  return NextResponse.json({ rapports })
}

// ── POST /api/rapports ─────────────────────────────────────────────────────────
// Supervisor only — generate and persist a new statistics report.
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== "SUPERVISEUR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { titre, periodeDebut, periodeFin } = await req.json()

    if (!titre || !periodeDebut || !periodeFin) {
      return NextResponse.json(
        { error: "titre, periodeDebut and periodeFin are required" },
        { status: 400 }
      )
    }

    const debut = new Date(periodeDebut)
    const fin   = new Date(periodeFin)

    // Aggregate stats within the requested period
    const [
      totalDossiers,
      parStatut,
      parFiliere,
      totalEtudiants,
      dossiersValides,
      dossiersRejetes,
      scoresMoyens,
    ] = await Promise.all([
      prisma.dossier.count({
        where: { dateCreation: { gte: debut, lte: fin } },
      }),
      prisma.dossier.groupBy({
        by:    ["statut"],
        _count: true,
        where: { dateCreation: { gte: debut, lte: fin } },
      }),
      prisma.dossier.groupBy({
        by:    ["filiereId"],
        _count: true,
        where: { dateCreation: { gte: debut, lte: fin }, filiereId: { not: null } },
      }),
      prisma.utilisateur.count({ where: { role: "ETUDIANT" } }),
      prisma.dossier.count({ where: { statut: "VALIDE" } }),
      prisma.dossier.count({ where: { statut: "REJETE" } }),
      prisma.dossier.aggregate({
        _avg: { score: true },
        where: { score: { not: null } },
      }),
    ])

    // Enrich filiere stats with names
    const filiereIds  = parFiliere.map((f) => f.filiereId).filter(Boolean) as string[]
    const filiereInfo = await prisma.filiere.findMany({
      where:  { id: { in: filiereIds } },
      select: { id: true, nom: true },
    })
    const filiereMap = Object.fromEntries(filiereInfo.map((f) => [f.id, f]))

    const contenu = {
      periode:         { debut: debut.toISOString(), fin: fin.toISOString() },
      totalEtudiants,
      totalDossiers,
      dossiersValides,
      dossiersRejetes,
      tauxValidation:  totalDossiers > 0
        ? Math.round((dossiersValides / totalDossiers) * 100)
        : 0,
      scoreMoyen:      scoresMoyens._avg.score ?? 0,
      parStatut:       parStatut.reduce<Record<string, number>>((acc, s) => {
        acc[s.statut] = s._count
        return acc
      }, {}),
      parFiliere:      parFiliere.map((f) => ({
        filiereId:  f.filiereId,
        nom:      filiereMap[f.filiereId!]?.nom ?? "Unknown",
        dossiers: f._count,
      })),
      generatedAt: new Date().toISOString(),
    }

    const rapport = await prisma.rapport.create({
      data: {
        titre,
        periodeDebut:  debut,
        periodeFin:    fin,
        superviseurId: session.id,
        contenu,
      },
    })

    return NextResponse.json({ rapport }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/rapports]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
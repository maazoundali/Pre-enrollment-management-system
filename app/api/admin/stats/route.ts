// app/api/admin/stats/route.ts
// GET — real-time dashboard statistics for admins and supervisors.

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { getActiveAnnee } from "@/lib/annee"

export async function GET(req: Request) {
  const session = await getSession()
  if (!session || session.role === "ETUDIANT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const anneeIdParam = searchParams.get("anneeId") || null

  // Resolve the annee to use: explicit param → active year → null (all years)
  const annee = anneeIdParam
    ? await prisma.anneeAcademique.findUnique({ where: { id: anneeIdParam } })
    : await getActiveAnnee()

  const anneeFilter = annee ? { anneeId: annee.id } : {}

  const [
    totalEtudiants,
    totalDossiers,
    parStatut,
    filieres,
    recentDossiers,
    scoresMoyens,
  ] = await Promise.all([
    // Total registered students
    prisma.utilisateur.count({ where: { role: "ETUDIANT" } }),

    // Total dossiers for the selected year
    prisma.dossier.count({ where: anneeFilter }),

    // Count per status for the selected year
    prisma.dossier.groupBy({
      by:    ["statut"],
      _count: true,
      where: anneeFilter,
    }),

    // All programs with their per-year fill rate
    (async () => {
      const rows = await prisma.filiere.findMany({
        include: {
          capacites: annee ? { where: { anneeId: annee.id } } : false,
          _count: {
            select: {
              dossiers: annee
                ? { where: { anneeId: annee.id, statut: "VALIDE" } }
                : true,
            },
          },
        },
        orderBy: { nom: "asc" },
      })
      return rows.map(f => {
        const cap = annee ? ((f.capacites as { capacite: number }[])[0]?.capacite ?? null) : null
        return { ...f, _capacite: cap }
      })
    })(),

    // Last 5 dossiers submitted (for activity feed) — filtered by year
    prisma.dossier.findMany({
      where:   { statut: { not: "BROUILLON" }, ...anneeFilter },
      include: {
        etudiant: { select: { nom: true, prenom: true, email: true } },
        filiere:  { select: { nom: true } },
      },
      orderBy: { dateMaj: "desc" },
      take:    5,
    }),

    // Average AI score across all analysed dossiers for the year
    prisma.dossier.aggregate({
      _avg: { score: true },
      where: { score: { not: null }, ...anneeFilter },
    }),
  ])

  const statutMap = parStatut.reduce<Record<string, number>>((acc, s) => {
    acc[s.statut] = s._count
    return acc
  }, {})

  return NextResponse.json({
    totalEtudiants,
    totalDossiers,
    parStatut:   statutMap,
    tauxValidation:
      totalDossiers > 0
        ? Math.round(((statutMap.VALIDE ?? 0) / totalDossiers) * 100)
        : 0,
    scoreMoyen: Math.round(scoresMoyens._avg.score ?? 0),
    filieres: filieres.map((f) => {
      const cap = (f as unknown as { _capacite: number | null })._capacite
      const ins = f._count.dossiers
      return {
        id:              f.id,
        nom:             f.nom,
        capacite:        cap,
        inscrits:        ins,
        estComplete:     cap !== null && ins >= cap,
        tauxRemplissage: (cap && cap > 0) ? Math.round((ins / cap) * 100) : 0,
      }
    }),
    recentDossiers,
  })
}
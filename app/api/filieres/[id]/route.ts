// app/api/filieres/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { getActiveAnnee } from "@/lib/annee"

type Params = { params: Promise<{ id: string }> }

// ── GET /api/filieres/:id ──────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const annee = await getActiveAnnee()

  const filiere = await prisma.filiere.findUnique({
    where: { id },
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
  })

  if (!filiere) return NextResponse.json({ error: "Introuvable." }, { status: 404 })

  const quota      = annee ? ((filiere.capacites as { capacite: number; objectif?: number | null }[])[0] ?? null) : null
  const capacite   = quota?.capacite ?? null
  const inscrits   = filiere._count.dossiers
  const estComplete = capacite !== null && inscrits >= capacite
  const taux       = (capacite && capacite > 0) ? Math.round((inscrits / capacite) * 100) : 0

  return NextResponse.json({
    filiere: {
      id:               filiere.id,
      nom:              filiere.nom,
      categorie:        filiere.categorie,
      description:      filiere.description,
      programme:        filiere.programme,
      duree:            filiere.duree,
      diplomeDelivre:   filiere.diplomeDelivre,
      langue:           filiere.langue,
      fraisInscription: filiere.fraisInscription,
      capacite,
      objectif:         quota?.objectif ?? null,
      inscrits,
      estComplete,
      tauxRemplissage:  taux,
    },
  })
}

// ── PUT /api/filieres/:id ──────────────────────────────────────────────────────
// Updates filière metadata only — capacity is managed via /capacite endpoint.

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session || session.role !== "ADMINISTRATEUR") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 })
  }

  const { id } = await params

  try {
    const { nom, categorie, description, programme, duree, diplomeDelivre, langue, fraisInscription } = await req.json()

    const filiere = await prisma.filiere.update({
      where: { id },
      data: {
        nom:              nom              ?? undefined,
        categorie:        categorie        !== undefined ? (categorie || null)        : undefined,
        description:      description      !== undefined ? (description || null)      : undefined,
        programme:        programme        !== undefined ? (programme || null)        : undefined,
        duree:            duree            !== undefined ? (duree || null)            : undefined,
        diplomeDelivre:   diplomeDelivre   !== undefined ? (diplomeDelivre || null)  : undefined,
        langue:           langue           !== undefined ? (langue || null)           : undefined,
        fraisInscription: fraisInscription !== undefined
          ? (fraisInscription ? parseFloat(fraisInscription) : null)
          : undefined,
      },
    })

    return NextResponse.json({ filiere })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Introuvable." }, { status: 404 })
    }
    console.error("[PUT /api/filieres/:id]", err)
    return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 })
  }
}

// ── DELETE /api/filieres/:id ───────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session || session.role !== "ADMINISTRATEUR") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 })
  }

  const { id } = await params

  try {
    await prisma.filiere.delete({ where: { id } })
    return NextResponse.json({ message: "Filière supprimée." })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Introuvable." }, { status: 404 })
    }
    console.error("[DELETE /api/filieres/:id]", err)
    return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 })
  }
}

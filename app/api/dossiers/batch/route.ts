// app/api/dossiers/batch/route.ts
// PATCH — admin only, bulk status transition on a set of dossiers

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { canTransition } from "@/lib/workflow"
import { createNotification } from "@/lib/notifications"
import { Statut } from "@prisma/client"

const STATUS_MESSAGES: Record<Statut, string> = {
  BROUILLON:     "Votre dossier a été remis en brouillon.",
  SOUMIS:        "Votre dossier a été soumis.",
  EN_ANALYSE:    "Votre dossier est en cours d'analyse par l'administration.",
  VALIDE:        "Félicitations ! Votre dossier a été validé.",
  REJETE:        "Votre dossier a été rejeté.",
  LISTE_ATTENTE: "Vous êtes sur liste d'attente.",
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== "ADMINISTRATEUR") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 })
  }

  try {
    const { ids, statut } = await req.json() as { ids: string[]; statut: Statut }

    if (!ids?.length || !statut) {
      return NextResponse.json({ error: "ids et statut sont obligatoires." }, { status: 400 })
    }
    if (ids.length > 200) {
      return NextResponse.json({ error: "Maximum 200 dossiers par batch." }, { status: 400 })
    }

    // Fetch current statuts
    const dossiers = await prisma.dossier.findMany({
      where: { id: { in: ids } },
      select: { id: true, statut: true, etudiantId: true },
    })

    const toUpdate = dossiers.filter((d) => canTransition(d.statut, statut))
    const skipped  = dossiers.length - toUpdate.length

    if (toUpdate.length === 0) {
      return NextResponse.json({ updated: 0, skipped, message: "Aucune transition valide." })
    }

    // Bulk update
    await prisma.dossier.updateMany({
      where: { id: { in: toUpdate.map((d) => d.id) } },
      data:  { statut },
    })

    // Notify each student
    const message = STATUS_MESSAGES[statut]
    await Promise.all(
      toUpdate.map((d) =>
        createNotification({ destinataireId: d.etudiantId, type: "STATUT_MAJ", message })
      )
    )

    return NextResponse.json({ updated: toUpdate.length, skipped })
  } catch (err) {
    console.error("[PATCH /api/dossiers/batch]", err)
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 })
  }
}

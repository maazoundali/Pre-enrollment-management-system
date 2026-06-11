// GET /api/filieres/:id/capacite  — read per-year quota for the active year
// PUT /api/filieres/:id/capacite  — set/update quota (admin only)
//
// Rules on PUT:
//   • capacite cannot decrease
//   • objectif must be ≤ capacite (if both provided)
//   • If capacity increases and waitlisted students exist, promote them automatically

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { getActiveAnnee } from "@/lib/annee"
import { createNotification } from "@/lib/notifications"
import { sendStatusEmail } from "@/lib/email"

type Params = { params: Promise<{ id: string }> }

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session || !["ADMINISTRATEUR", "SUPERVISEUR"].includes(session.role)) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 })
  }

  const { id } = await params
  const annee = await getActiveAnnee()
  if (!annee) return NextResponse.json({ error: "Aucune année académique active." }, { status: 422 })

  const quota = await prisma.filiereCapacite.findUnique({
    where: { filiereId_anneeId: { filiereId: id, anneeId: annee.id } },
  })

  // Count current VALIDE dossiers for this filière in the active year
  const enrolled = await prisma.dossier.count({
    where: { filiereId: id, anneeId: annee.id, statut: "VALIDE" },
  })

  const waitlisted = await prisma.dossier.count({
    where: { filiereId: id, anneeId: annee.id, statut: "LISTE_ATTENTE" },
  })

  return NextResponse.json({
    annee:     { id: annee.id, libelle: annee.libelle },
    quota,                       // null = no quota defined → unlimited
    enrolled,
    waitlisted,
    available: quota ? Math.max(0, quota.capacite - enrolled) : null,
  })
}

// ── PUT ───────────────────────────────────────────────────────────────────────
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session || session.role !== "ADMINISTRATEUR") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json() as { capacite: number; objectif?: number | null }
  const { capacite, objectif } = body

  if (!Number.isInteger(capacite) || capacite < 0) {
    return NextResponse.json({ error: "La capacité doit être un entier positif." }, { status: 400 })
  }
  if (objectif !== undefined && objectif !== null && (objectif < 0 || objectif > capacite)) {
    return NextResponse.json(
      { error: "L'objectif doit être compris entre 0 et la capacité." },
      { status: 400 }
    )
  }

  const annee = await getActiveAnnee()
  if (!annee) return NextResponse.json({ error: "Aucune année académique active." }, { status: 422 })

  const filiere = await prisma.filiere.findUnique({ where: { id } })
  if (!filiere) return NextResponse.json({ error: "Filière introuvable." }, { status: 404 })

  // Check existing quota — capacity must not decrease
  const existing = await prisma.filiereCapacite.findUnique({
    where: { filiereId_anneeId: { filiereId: id, anneeId: annee.id } },
  })
  if (existing && capacite < existing.capacite) {
    return NextResponse.json(
      { error: `La capacité ne peut pas être réduite (actuelle : ${existing.capacite}).` },
      { status: 422 }
    )
  }

  const capaciteIncreased = existing && capacite > existing.capacite
  const spotsAdded = capaciteIncreased ? capacite - existing.capacite : 0

  // Upsert the quota
  const quota = await prisma.filiereCapacite.upsert({
    where:  { filiereId_anneeId: { filiereId: id, anneeId: annee.id } },
    update: { capacite, objectif: objectif ?? null },
    create: { filiereId: id, anneeId: annee.id, capacite, objectif: objectif ?? null },
  })

  // Auto-promote waitlisted students if capacity increased
  if (spotsAdded > 0) {
    const waitlisted = await prisma.dossier.findMany({
      where:   { filiereId: id, anneeId: annee.id, statut: "LISTE_ATTENTE" },
      orderBy: { rangListeAttente: "asc" },
      take:    spotsAdded,
      include: { etudiant: { select: { id: true, email: true, prenom: true } } },
    })

    for (const d of waitlisted) {
      await prisma.dossier.update({
        where: { id: d.id },
        data:  { statut: "EN_ANALYSE", rangListeAttente: null },
      })
      await createNotification({
        destinataireId: d.etudiantId,
        type: "STATUT_MAJ",
        message: "Une place s'est libérée ! Votre dossier est maintenant en cours d'analyse. 🎉",
      })
      void sendStatusEmail({
        to: d.etudiant.email, prenom: d.etudiant.prenom,
        dossierId: d.id, statut: "EN_ANALYSE",
      })
    }

    if (waitlisted.length > 0) {
      console.log(`[capacite] Promoted ${waitlisted.length} waitlisted student(s) for filière ${id} (year ${annee.libelle})`)
    }
  }

  return NextResponse.json({ quota })
}

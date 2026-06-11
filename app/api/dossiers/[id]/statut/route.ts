// app/api/dossiers/[id]/statut/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { validateTransition } from "@/lib/workflow"
import { createNotification } from "@/lib/notifications"
import { logAudit } from "@/lib/audit"
import { sendStatusEmail } from "@/lib/email"
import { Statut } from "@prisma/client"

type Params = { params: Promise<{ id: string }> }

const STATUS_MESSAGES: Record<Statut, string> = {
  BROUILLON:     "Votre dossier a été remis en brouillon.",
  SOUMIS:        "Votre dossier a été soumis avec succès. Vous serez notifié de la suite.",
  EN_ANALYSE:    "Votre dossier est en cours d'analyse par l'administration.",
  VALIDE:        "Félicitations ! Votre dossier a été validé.",
  REJETE:        "Votre dossier a été rejeté. Vous pouvez le corriger et le resoumettre.",
  LISTE_ATTENTE: "Vous êtes sur liste d'attente pour cette filière. Vous serez notifié si une place se libère.",
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id }    = await params
  const body      = await req.json()
  const newStatut = body.statut as Statut
  const motifRejet: string | undefined = body.motifRejet?.trim() || undefined

  if (!newStatut) {
    return NextResponse.json({ error: "statut field is required" }, { status: 400 })
  }

  if (newStatut === "REJETE" && session.role === "ADMINISTRATEUR" && !motifRejet) {
    return NextResponse.json({ error: "Un motif de rejet est obligatoire." }, { status: 400 })
  }

  try {
    const dossier = await prisma.dossier.findUnique({
      where: { id },
      include: { etudiant: { select: { id: true, email: true, prenom: true } } },
    })

    if (!dossier) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (session.role === "ETUDIANT" && dossier.etudiantId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    validateTransition(dossier.statut, newStatut, session.role)

    // ── Capacity / waitlist check on student submission (year-scoped) ─────────
    let actualStatut = newStatut
    let assignedRang: number | null = null

    if (session.role === "ETUDIANT" && newStatut === "SOUMIS" && dossier.filiereId) {
      const quota = await prisma.filiereCapacite.findUnique({
        where: { filiereId_anneeId: { filiereId: dossier.filiereId, anneeId: dossier.anneeId } },
      })
      if (quota) {
        // Only VALIDE dossiers count toward capacity, scoped to the same academic year
        const validatedCount = await prisma.dossier.count({
          where: { filiereId: dossier.filiereId, anneeId: dossier.anneeId, statut: "VALIDE" },
        })
        if (validatedCount >= quota.capacite) {
          actualStatut = "LISTE_ATTENTE"
          const waitlistCount = await prisma.dossier.count({
            where: { filiereId: dossier.filiereId, anneeId: dossier.anneeId, statut: "LISTE_ATTENTE" },
          })
          assignedRang = waitlistCount + 1
        }
      }
      // No quota defined → unlimited; dossier goes to SOUMIS normally
    }

    const updated = await prisma.dossier.update({
      where: { id },
      data: {
        statut:           actualStatut,
        motifRejet:       actualStatut === "REJETE" ? (motifRejet ?? null) : null,
        rangListeAttente: actualStatut === "LISTE_ATTENTE" ? assignedRang : null,
      },
    })

    const message = actualStatut === "REJETE" && motifRejet
      ? `Votre dossier a été rejeté. Motif : ${motifRejet}`
      : STATUS_MESSAGES[actualStatut]

    const notifType = (actualStatut === "VALIDE" || actualStatut === "REJETE")
      ? "DECISION_ADMIN"
      : "STATUT_MAJ"

    await createNotification({ destinataireId: dossier.etudiantId, type: notifType, message })

    await logAudit(session.id, id, "STATUT_CHANGE", {
      from: dossier.statut,
      to:   actualStatut,
      ...(motifRejet  ? { motif: motifRejet }       : {}),
      ...(assignedRang ? { waitlistRank: assignedRang } : {}),
    })

    const emailStatuts: Statut[] = ["SOUMIS", "EN_ANALYSE", "VALIDE", "REJETE", "LISTE_ATTENTE"]
    if (emailStatuts.includes(actualStatut)) {
      void sendStatusEmail({
        to: dossier.etudiant.email, prenom: dossier.etudiant.prenom,
        dossierId: id, statut: actualStatut, motifRejet: motifRejet ?? null,
      })
    }

    // ── Automatic waitlist promotion (year-scoped) ─────────────────────────
    // When a VALIDE dossier is revoked (→ BROUILLON/REJETE), promote the top
    // waitlisted student for the same filière AND the same academic year.
    const spotFreed = dossier.statut === "VALIDE" &&
      (actualStatut === "BROUILLON" || actualStatut === "REJETE") &&
      dossier.filiereId

    if (spotFreed && dossier.filiereId) {
      const topWaiting = await prisma.dossier.findFirst({
        where:   { filiereId: dossier.filiereId, anneeId: dossier.anneeId, statut: "LISTE_ATTENTE" },
        orderBy: { rangListeAttente: "asc" },
        include: { etudiant: { select: { id: true, email: true, prenom: true } } },
      })
      if (topWaiting) {
        await prisma.dossier.update({
          where: { id: topWaiting.id },
          data:  { statut: "EN_ANALYSE", rangListeAttente: null },
        })
        await createNotification({
          destinataireId: topWaiting.etudiantId,
          type: "STATUT_MAJ",
          message: "Une place s'est libérée ! Votre dossier est maintenant en cours d'analyse. 🎉",
        })
        void sendStatusEmail({
          to: topWaiting.etudiant.email, prenom: topWaiting.etudiant.prenom,
          dossierId: topWaiting.id, statut: "EN_ANALYSE",
        })
        console.log(`[waitlist] Promoted ${topWaiting.id} for filière ${dossier.filiereId} (year ${dossier.anneeId})`)
      }
    }

    return NextResponse.json({ dossier: updated })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error"
    if (message.startsWith("Invalid transition") || message.startsWith("Role")) {
      return NextResponse.json({ error: message }, { status: 422 })
    }
    console.error("[PATCH /api/dossiers/:id/statut]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

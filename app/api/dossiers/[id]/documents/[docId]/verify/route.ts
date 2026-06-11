// PATCH /api/dossiers/:id/documents/:docId/verify
// Admin sets verification status on a document and optionally notifies the student.

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { createNotification } from "@/lib/notifications"
import { sendDocumentVerificationEmail } from "@/lib/email"
import { logAudit } from "@/lib/audit"
import { VerificationDoc } from "@prisma/client"

type Params = { params: Promise<{ id: string; docId: string }> }

const DOC_TYPE_LABELS: Record<string, string> = {
  CNI: "Carte d'identité", PASSEPORT: "Passeport", DIPLOME: "Diplôme",
  RELEVE_NOTES: "Relevé de notes", PHOTO: "Photo d'identité", AUTRE: "Autre",
}

const VERIFICATION_MESSAGES: Record<VerificationDoc, (docType: string, note?: string | null) => string> = {
  VERIFIED:       (t)    => `Votre document "${t}" a été vérifié et accepté par l'administration. ✓`,
  REJECTED:       (t, n) => `Votre document "${t}" a été refusé.${n ? ` Motif : ${n}` : ""} Veuillez le corriger et le resoumettre.`,
  NEEDS_REUPLOAD: (t, n) => `Votre document "${t}" est lisible mais une meilleure version est demandée.${n ? ` Remarque : ${n}` : ""} ⚠`,
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session || session.role !== "ADMINISTRATEUR") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 })
  }

  const { id, docId } = await params
  const body = await req.json() as {
    verification: VerificationDoc
    note?: string
    notify?: boolean
  }
  const { verification, note, notify = true } = body

  if (!Object.values(VerificationDoc).includes(verification)) {
    return NextResponse.json({ error: "Statut de vérification invalide." }, { status: 400 })
  }

  const doc = await prisma.document.findFirst({ where: { id: docId, dossierId: id } })
  if (!doc) return NextResponse.json({ error: "Document introuvable." }, { status: 404 })

  const dossier = await prisma.dossier.findUnique({
    where: { id },
    include: { etudiant: { select: { id: true, email: true, prenom: true } } },
  })
  if (!dossier) return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 })

  const updated = await prisma.document.update({
    where: { id: docId },
    data: {
      verification,
      verificationNote: note?.trim() || null,
      verifiedAt:       new Date(),
      verifiedBy:       session.id,
    },
  })

  await logAudit(session.id, id, "DOCUMENT_VERIFIED", {
    docId,
    docType: doc.type,
    verification,
    note: note || null,
  })

  if (notify) {
    const docLabel  = DOC_TYPE_LABELS[doc.type] ?? doc.type
    const message   = VERIFICATION_MESSAGES[verification](docLabel, note)
    await createNotification({
      destinataireId: dossier.etudiantId,
      type:           "DOSSIER_MAJ",
      message,
    })
    // Also send email
    void sendDocumentVerificationEmail({
      to:           dossier.etudiant.email,
      prenom:       dossier.etudiant.prenom,
      dossierId:    id,
      docType:      docLabel,
      verification,
      note,
    })
  }

  return NextResponse.json({ document: updated })
}

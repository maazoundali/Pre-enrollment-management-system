// POST /api/admin/message
// Admin sends a free-text message to a specific student (in-app notification + email).

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { createNotification } from "@/lib/notifications"
import { sendAdminMessageEmail } from "@/lib/email"
import { logAudit } from "@/lib/audit"

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== "ADMINISTRATEUR") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 })
  }

  const body = await req.json() as { dossierId: string; message: string }
  const { dossierId, message } = body

  if (!dossierId || !message?.trim()) {
    return NextResponse.json({ error: "dossierId et message sont requis." }, { status: 400 })
  }

  const trimmed = message.trim()
  if (trimmed.length > 2000) {
    return NextResponse.json({ error: "Le message ne peut pas dépasser 2000 caractères." }, { status: 400 })
  }

  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: { etudiant: { select: { id: true, email: true, prenom: true, nom: true } } },
  })
  if (!dossier) return NextResponse.json({ error: "Dossier introuvable." }, { status: 404 })

  await createNotification({
    destinataireId: dossier.etudiantId,
    type: "DOSSIER_MAJ",
    message: `Message de l'administration : ${trimmed}`,
  })

  void sendAdminMessageEmail({
    to:        dossier.etudiant.email,
    prenom:    dossier.etudiant.prenom,
    dossierId: dossier.id,
    message:   trimmed,
  })

  await logAudit(session.id, dossierId, "NOTE_ADDED", {
    excerpt: trimmed.slice(0, 120) + (trimmed.length > 120 ? "…" : ""),
    channel: "admin_message",
  })

  return NextResponse.json({ ok: true })
}

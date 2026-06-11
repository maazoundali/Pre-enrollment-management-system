// POST /api/admin/send-reminders
// Sends deadline reminder emails to students whose dossiers are still BROUILLON.
// Called automatically by a cron job (CRON_SECRET header) or manually by an admin.
//
// Cron usage (e.g. Vercel cron or external):
//   POST /api/admin/send-reminders
//   Authorization: Bearer <CRON_SECRET env var>
//
// The route only sends reminders when the enrollment closing date is within
// the configured window (default: 48 h). If called outside this window and
// force=true is passed in the body, it sends anyway (admin manual trigger).

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { sendDeadlineReminderEmail } from "@/lib/email"
import { createNotification } from "@/lib/notifications"

const REMINDER_WINDOW_HOURS = 48

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  // Accept either an authenticated admin session OR a cron secret header
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  const isCron     = cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isCron) {
    const session = await getSession()
    if (!session || session.role !== "ADMINISTRATEUR") {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 })
    }
  }

  let force = false
  try { force = (await req.json())?.force === true } catch { /* no body */ }

  // Read inscription_fin from parametres
  const param = await prisma.parametreSysteme.findUnique({ where: { cle: "inscription_fin" } })

  if (!param?.valeur) {
    return NextResponse.json({ error: "La date de fermeture des inscriptions (inscription_fin) n'est pas configurée." }, { status: 422 })
  }

  const closingDate = new Date(param.valeur)
  if (isNaN(closingDate.getTime())) {
    return NextResponse.json({ error: "La date de fermeture est invalide." }, { status: 422 })
  }

  const now           = new Date()
  const hoursUntilEnd = (closingDate.getTime() - now.getTime()) / (1000 * 60 * 60)

  // Only send if within the 48-hour window (or forced by admin)
  if (!force && (hoursUntilEnd < 0 || hoursUntilEnd > REMINDER_WINDOW_HOURS)) {
    return NextResponse.json({
      skipped: true,
      reason:  `La clôture est dans ${Math.round(hoursUntilEnd)} h (seuil : ${REMINDER_WINDOW_HOURS} h). Passez force=true pour forcer l'envoi.`,
      hoursUntilEnd: Math.round(hoursUntilEnd),
    })
  }

  // Fetch all BROUILLON dossiers with student email
  const dossiers = await prisma.dossier.findMany({
    where: { statut: "BROUILLON" },
    include: {
      etudiant: { select: { id: true, email: true, prenom: true, nom: true } },
      filiere:  { select: { nom: true } },
    },
  })

  if (dossiers.length === 0) {
    return NextResponse.json({ sent: 0, message: "Aucun dossier en brouillon trouvé." })
  }

  let sent = 0
  const errors: string[] = []

  for (const dossier of dossiers) {
    try {
      await createNotification({
        destinataireId: dossier.etudiantId,
        type: "STATUT_MAJ",
        message: `⏰ Rappel : les inscriptions ferment le ${closingDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}. Votre dossier est encore en brouillon — pensez à le soumettre !`,
      })

      void sendDeadlineReminderEmail({
        to:          dossier.etudiant.email,
        prenom:      dossier.etudiant.prenom,
        dossierId:   dossier.id,
        closingDate,
        filiere:     dossier.filiere?.nom ?? null,
      })

      sent++
    } catch (err) {
      errors.push(`${dossier.etudiant.email}: ${(err as Error).message}`)
    }
  }

  console.log(`[reminders] Sent ${sent}/${dossiers.length} deadline reminders (closes in ${Math.round(hoursUntilEnd)} h)`)

  return NextResponse.json({
    sent,
    total: dossiers.length,
    closingDate: closingDate.toISOString(),
    hoursUntilEnd: Math.round(hoursUntilEnd),
    errors: errors.length > 0 ? errors : undefined,
  })
}

// app/api/dossiers/[id]/analyse/route.ts
// POST — triggers the AI engine on a dossier, persists the Analyse, notifies student.

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { analyserDossier } from "@/lib/ai/analyser"
import { createNotification } from "@/lib/notifications"
import { logAudit } from "@/lib/audit"

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const dossier = await prisma.dossier.findUnique({ where: { id } })
  if (!dossier) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Students can trigger analysis on their own dossier;
  // Admins can trigger it on any dossier.
  if (session.role === "ETUDIANT" && dossier.etudiantId !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (session.role === "SUPERVISEUR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await req.json().catch(() => ({})) as { locale?: string }
    const locale = (body.locale === "en" || body.locale === "ar") ? body.locale : "fr"
    console.log("🔍 [analyse route] triggered for dossier:", id, "| locale:", locale)
    const result = await analyserDossier(id, locale)

    // Persist the analysis result and recommendations in one transaction
    const analyse = await prisma.$transaction(async (tx) => {
      const a = await tx.analyse.create({
        data: {
          dossierId: id,
          score:     result.score,
          resultat:  result.resultat,
          complet:   result.complet,
          filiereRecommandations: {
            create: result.filiereRecommandations,
          },
        },
        include: {
          filiereRecommandations: {
            include: { filiere: { select: { id: true, nom: true } } },
            orderBy: { rang: "asc" },
          },
        },
      })

      // Update dossier score
      await tx.dossier.update({
        where: { id },
        data:  { score: result.score },
      })

      return a
    })

    // Notify student
    if (!result.complet) {
      await createNotification({
        destinataireId: dossier.etudiantId,
        type:           "DOSSIER_INCOMPLET",
        message: `Votre dossier est incomplet. Documents manquants : ${result.manquants.join(", ")}.`,
      })
    } else {
      await createNotification({
        destinataireId: dossier.etudiantId,
        type:           "RECOMMANDATION",
        message: `Analyse complète. Score : ${result.score}/100. Consultez vos recommandations de filières.`,
      })
    }

    await logAudit(session.id, id, "ANALYSE_RUN", {
      score:   result.score,
      complet: result.complet,
    })

    return NextResponse.json({ analyse, manquants: result.manquants })
  } catch (err) {
    console.error("[POST /api/dossiers/:id/analyse]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
// PATCH /api/admin/annees/:id — archive a year
// Restriction: cannot archive if it's the only year in the system.
// Archived years remain processable (admins can still validate/reject dossiers).

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session || session.role !== "ADMINISTRATEUR") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 })
  }

  const { id } = await params

  const annee = await prisma.anneeAcademique.findUnique({ where: { id } })
  if (!annee) return NextResponse.json({ error: "Année introuvable." }, { status: 404 })
  if (annee.archivee) return NextResponse.json({ error: "Cette année est déjà archivée." }, { status: 409 })

  // Block if it's the only non-archived year
  const nonArchivedCount = await prisma.anneeAcademique.count({ where: { archivee: false } })
  if (nonArchivedCount <= 1) {
    return NextResponse.json(
      { error: "Impossible d'archiver la seule année non archivée du système." },
      { status: 422 }
    )
  }

  const updated = await prisma.anneeAcademique.update({
    where: { id },
    data:  { active: false, archivee: true },
  })

  return NextResponse.json({ annee: updated })
}

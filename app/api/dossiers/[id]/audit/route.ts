// app/api/dossiers/[id]/audit/route.ts — admin/supervisor only

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role === "ETUDIANT") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 })
  }

  const { id } = await params
  const logs = await prisma.auditLog.findMany({
    where: { dossierId: id },
    orderBy: { dateAction: "desc" },
    include: { auteur: { select: { nom: true, prenom: true, email: true } } },
  })

  return NextResponse.json({ logs })
}

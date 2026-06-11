// GET /api/annees — list all academic years, accessible to any authenticated user

import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Non authentifié." }, { status: 401 })

  const annees = await prisma.anneeAcademique.findMany({
    orderBy: { dateCreation: "desc" },
    select: { id: true, libelle: true, active: true, archivee: true },
  })

  return NextResponse.json({ annees })
}

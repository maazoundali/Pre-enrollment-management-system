// app/api/rapports/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

type Params = { params: Promise<{ id: string }> }

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session || session.role !== "SUPERVISEUR") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 })
  }

  const { id } = await params

  try {
    // Only the supervisor who created the report can delete it
    const rapport = await prisma.rapport.findUnique({ where: { id } })
    if (!rapport) {
      return NextResponse.json({ error: "Rapport introuvable." }, { status: 404 })
    }
    if (rapport.superviseurId !== session.id) {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 })
    }

    await prisma.rapport.delete({ where: { id } })
    return NextResponse.json({ message: "Rapport supprimé." })
  } catch (err) {
    console.error("[DELETE /api/rapports/:id]", err)
    return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 })
  }
}
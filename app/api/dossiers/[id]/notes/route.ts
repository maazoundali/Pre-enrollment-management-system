// app/api/dossiers/[id]/notes/route.ts
// GET  — admin/supervisor only, list internal notes on a dossier
// POST — admin only, add a note

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { logAudit } from "@/lib/audit"

// ── GET /api/dossiers/[id]/notes ──────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role === "ETUDIANT") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 })
  }
  const { id } = await params
  const notes = await prisma.noteInterne.findMany({
    where: { dossierId: id },
    orderBy: { dateCreation: "desc" },
    include: { auteur: { select: { nom: true, prenom: true, email: true } } },
  })
  return NextResponse.json({ notes })
}

// ── POST /api/dossiers/[id]/notes ─────────────────────────────────────────────
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role === "ETUDIANT") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 })
  }
  const { id } = await params
  try {
    const { contenu } = await req.json()
    if (!contenu?.trim()) {
      return NextResponse.json({ error: "La note ne peut pas être vide." }, { status: 400 })
    }
    const note = await prisma.noteInterne.create({
      data: { contenu: contenu.trim(), dossierId: id, auteurId: session.id },
      include: { auteur: { select: { nom: true, prenom: true, email: true } } },
    })
    await logAudit(session.id, id, "NOTE_ADDED", { excerpt: contenu.trim().slice(0, 80) })

    return NextResponse.json({ note }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/dossiers/[id]/notes]", err)
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 })
  }
}

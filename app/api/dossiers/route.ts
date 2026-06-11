// app/api/dossiers/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { Statut, NiveauEtude, TypeCours, SourceDecouverte } from "@prisma/client"
import { getActiveAnnee, isYearOpen } from "@/lib/annee"

// Shared select for dossier lists — enough for cards and tables
const DOSSIER_LIST_SELECT = {
  id:           true,
  dateCreation: true,
  dateMaj:      true,
  statut:       true,
  score:        true,
  motifRejet:        true,
  rangListeAttente:  true,

  // Academic fields
  niveauEtude:      true,
  typeCours:        true,
  sourceDecouverte: true,

  annee: { select: { id: true, libelle: true } },

  diplomes: { orderBy: { annee: "desc" as const } },

  etudiant: {
    select: {
      id:             true,
      nom:            true,
      prenom:         true,
      email:          true,
      typeIdentite:   true,
      numeroIdentite: true,
      sexe:           true,
      pays:           true,
      telephone:      true,
    },
  },
  filiere: {
    select: {
      id:              true,
      nom:             true,
      duree:           true,
      diplomeDelivre:  true,
      langue:          true,
    },
  },
  _count: { select: { documents: true, analyses: true } },
}

// ── GET /api/dossiers ──────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const statut      = searchParams.get("statut")      as Statut | null
  const niveauEtude = searchParams.get("niveauEtude") as NiveauEtude | null
  const typeCours   = searchParams.get("typeCours")   as TypeCours | null
  const filiereId   = searchParams.get("filiereId")
  const anneeId     = searchParams.get("anneeId")
  const page        = Math.max(1, parseInt(searchParams.get("page")  ?? "1"))
  const limit       = Math.min(200, parseInt(searchParams.get("limit") ?? "20"))

  const where: Record<string, unknown> = {}
  if (session.role === "ETUDIANT") where.etudiantId = session.id
  if (statut)      where.statut      = statut
  if (filiereId)   where.filiereId   = filiereId
  if (niveauEtude) where.niveauEtude = niveauEtude
  if (typeCours)   where.typeCours   = typeCours
  if (anneeId)     where.anneeId     = anneeId

  try {
    const [dossiers, total] = await Promise.all([
      prisma.dossier.findMany({
        where,
        select:  DOSSIER_LIST_SELECT,
        orderBy: { dateMaj: "desc" },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.dossier.count({ where }),
    ])

    return NextResponse.json({ dossiers, total, page, limit, pages: Math.ceil(total / limit) })
  } catch (err) {
    console.error("[GET /api/dossiers]", err)
    return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 })
  }
}

// ── POST /api/dossiers ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== "ETUDIANT") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 })
  }

  // ── Active year check ─────────────────────────────────────────────────────
  const annee = await getActiveAnnee()
  if (!annee) {
    return NextResponse.json(
      { error: "Aucune année académique active. Les inscriptions ne sont pas ouvertes.", enrollmentClosed: true },
      { status: 403 }
    )
  }

  // ── Enrollment period check (per year) ────────────────────────────────────
  if (!isYearOpen(annee)) {
    const now = new Date()
    const msg = (annee.dateOuverture && now < annee.dateOuverture)
      ? "Les inscriptions ne sont pas encore ouvertes pour cette année académique."
      : "La période d'inscription est terminée pour cette année académique."
    return NextResponse.json({ error: msg, enrollmentClosed: true }, { status: 403 })
  }

  // ── Duplicate prevention — one active dossier per student per year ─────────
  const existing = await prisma.dossier.findFirst({
    where: {
      etudiantId: session.id,
      anneeId:    annee.id,
      statut:     { not: "REJETE" },
    },
    select: { id: true, statut: true },
  })
  if (existing) {
    return NextResponse.json(
      { error: "Vous avez déjà un dossier en cours pour cette année académique.", existingId: existing.id },
      { status: 409 }
    )
  }

  try {
    const body = await req.json()
    const { filiereId, dernierDiplome, anneeDiplome, diplomeVise, niveauEtude, typeCours, sourceDecouverte } = body

    const dossier = await prisma.dossier.create({
      data: {
        etudiantId:       session.id,
        anneeId:          annee.id,
        filiereId:        filiereId       ?? null,
        statut:           "BROUILLON",
        dernierDiplome:   dernierDiplome   ?? null,
        anneeDiplome:     anneeDiplome     ? parseInt(anneeDiplome) : null,
        diplomeVise:      diplomeVise      ?? null,
        niveauEtude:      niveauEtude      as NiveauEtude ?? null,
        typeCours:        typeCours        as TypeCours ?? null,
        sourceDecouverte: sourceDecouverte as SourceDecouverte ?? null,
      },
      select: DOSSIER_LIST_SELECT,
    })

    return NextResponse.json({ dossier }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/dossiers]", err)
    return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 })
  }
}

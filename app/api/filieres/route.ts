// app/api/filieres/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { getActiveAnnee } from "@/lib/annee"

// ── GET /api/filieres ──────────────────────────────────────────────────────────
// Returns programs. Capacity is per-year (FiliereCapacite for the active year).
// Admins/supervisors get exact numbers; students get a status label only.

function capacityStatus(taux: number, estComplete: boolean): "COMPLET" | "LIMITE" | "REDUIT" | "OUVERT" {
  if (estComplete || taux >= 100) return "COMPLET"
  if (taux >= 80)                  return "LIMITE"
  if (taux >= 50)                  return "REDUIT"
  return "OUVERT"
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  const isAdmin = session?.role === "ADMINISTRATEUR" || session?.role === "SUPERVISEUR"

  // Resolve active year to pull per-year quota
  const annee = await getActiveAnnee()

  const filieres = await prisma.filiere.findMany({
    include: {
      capacites: annee
        ? { where: { anneeId: annee.id } }
        : false,
      _count: {
        select: {
          // Count only VALIDE dossiers in the active year for fill rate
          dossiers: annee
            ? { where: { anneeId: annee.id, statut: "VALIDE" } }
            : true,
        },
      },
    },
    orderBy: { nom: "asc" },
  })

  const res = NextResponse.json({
    filieres: filieres.map((f) => {
      const quota      = annee ? ((f.capacites as { capacite: number }[])[0] ?? null) : null
      const inscrits   = f._count.dossiers
      const capacite   = quota?.capacite ?? null
      const taux       = (capacite && capacite > 0) ? Math.round((inscrits / capacite) * 100) : 0
      const estComplete = capacite !== null && inscrits >= capacite

      const base = {
        id:               f.id,
        nom:              f.nom,
        categorie:        f.categorie,
        description:      f.description,
        programme:        f.programme,
        duree:            f.duree,
        diplomeDelivre:   f.diplomeDelivre,
        langue:           f.langue,
        fraisInscription: f.fraisInscription,
        estComplete,
        tauxRemplissage:  taux,
      }

      if (isAdmin) {
        return { ...base, capacite, objectif: quota ? (quota as { objectif?: number | null }).objectif ?? null : null, inscrits }
      }
      return { ...base, capacite: null, inscrits: null, capaciteStatut: capacityStatus(taux, estComplete) }
    }),
  })

  res.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60")
  return res
}

// ── POST /api/filieres ─────────────────────────────────────────────────────────
// Admin only — creates a filière without capacity (capacity is set per year).

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || session.role !== "ADMINISTRATEUR") {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 })
  }

  try {
    const { nom, description, programme, duree, diplomeDelivre, langue, fraisInscription, categorie } = await req.json()

    if (!nom?.trim()) {
      return NextResponse.json({ error: "Le nom est obligatoire." }, { status: 400 })
    }

    const filiere = await prisma.filiere.create({
      data: {
        nom:              nom.trim(),
        categorie:        categorie        || null,
        description:      description      || null,
        programme:        programme        || null,
        duree:            duree            || null,
        diplomeDelivre:   diplomeDelivre   || null,
        langue:           langue           || null,
        fraisInscription: fraisInscription ? parseFloat(fraisInscription) : null,
      },
    })

    // Link to creating admin
    await prisma.adminFiliere.create({
      data: { administrateurId: session.id, filiereId: filiere.id },
    })

    return NextResponse.json({ filiere }, { status: 201 })
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Une filière avec ce nom existe déjà." }, { status: 409 })
    }
    console.error("[POST /api/filieres]", err)
    return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 })
  }
}

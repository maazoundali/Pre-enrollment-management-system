// app/api/dossiers/[id]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { NiveauEtude, TypeCours, SourceDecouverte } from "@prisma/client"
import { logAudit } from "@/lib/audit"
import { createNotification } from "@/lib/notifications"

type Params = { params: Promise<{ id: string }> }

// Full detail select — used in GET and returned after updates
const DOSSIER_DETAIL_SELECT = {
  id:           true,
  dateCreation: true,
  dateMaj:      true,
  statut:       true,
  score:        true,
  motifRejet:   true,

  // Academic fields
  dernierDiplome:   true,
  anneeDiplome:     true,
  diplomeVise:      true,
  niveauEtude:      true,
  typeCours:        true,
  sourceDecouverte: true,
  notes:            true,

  // Student with full profile
  etudiant: {
    select: {
      id:             true,
      nom:            true,
      prenom:         true,
      email:          true,
      dateNaissance:  true,
      typeIdentite:   true,
      numeroIdentite: true,
      sexe:           true,
      adresse:        true,
      pays:           true,
      telephone:      true,
    },
  },

  // Filiere with all info (capacite is per-year — not on Filiere model)
  filiere: {
    select: {
      id:              true,
      nom:             true,
      description:     true,
      programme:       true,
      duree:           true,
      diplomeDelivre:  true,
      langue:          true,
      fraisInscription: true,
    },
  },

  documents: { orderBy: { dateUpload: "desc" as const } },

  diplomes: { orderBy: { annee: "desc" as const } },

  analyses: {
    include: {
      filiereRecommandations: {
        include: { filiere: { select: { id: true, nom: true } } },
        orderBy: { rang: "asc" as const },
      },
    },
    orderBy: { dateAnalyse: "desc" as const },
    take: 1,
  },
}

// ── GET /api/dossiers/:id ──────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 })

  const { id } = await params

  const dossier = await prisma.dossier.findUnique({
    where: { id },
    select: DOSSIER_DETAIL_SELECT,
  })

  if (!dossier) return NextResponse.json({ error: "Introuvable." }, { status: 404 })

  if (session.role === "ETUDIANT" && dossier.etudiant.id !== session.id) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 })
  }

  return NextResponse.json({ dossier })
}

// ── PUT /api/dossiers/:id ──────────────────────────────────────────────────────
// Students can edit their own BROUILLON dossiers — all academic fields + filiere

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 })

  const { id } = await params

  const existing = await prisma.dossier.findUnique({
    where: { id },
    select: {
      etudiantId: true, statut: true,
      filiereId: true, niveauEtude: true, typeCours: true, sourceDecouverte: true,
      etudiant: { select: { nom:true, prenom:true, email:true, dateNaissance:true, typeIdentite:true, numeroIdentite:true, sexe:true, adresse:true, pays:true, telephone:true } },
    },
  })
  if (!existing) return NextResponse.json({ error: "Introuvable." }, { status: 404 })

  const isAdmin   = session.role === "ADMINISTRATEUR"
  const isStudent = session.role === "ETUDIANT"

  if (isStudent) {
    if (existing.etudiantId !== session.id) {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 })
    }
    if (existing.statut !== "BROUILLON" && existing.statut !== "REJETE") {
      return NextResponse.json(
        { error: "Seuls les dossiers en brouillon ou rejetés peuvent être modifiés." },
        { status: 422 }
      )
    }
  }
  // Admins can edit any dossier regardless of status

  try {
    const body = await req.json()
    const {
      filiereId,
      niveauEtude,
      typeCours,
      sourceDecouverte,
      notes,
      diplomes,
      etudiant, // admin-only: update student profile fields
    } = body

    // Track changed fields for audit log + notification
    const changedFields: string[] = []

    const updated = await prisma.$transaction(async (tx) => {
      // ── Update student profile (admin only) ───────────────────────────────
      if (isAdmin && etudiant && typeof etudiant === "object") {
        const profileUpdate: Record<string, string | Date | null> = {}
        const textFieldLabels: Record<string, string> = {
          nom: "Nom", prenom: "Prénom", email: "Email",
          typeIdentite: "Pièce d'identité", numeroIdentite: "Numéro d'identité",
          sexe: "Sexe", adresse: "Adresse", pays: "Pays", telephone: "Téléphone",
        }
        const currentEtudiant = existing.etudiant as Record<string, unknown> ?? {}
        const textFields = Object.keys(textFieldLabels) as (keyof typeof textFieldLabels)[]
        for (const f of textFields) {
          if (etudiant[f] !== undefined) {
            const incoming = etudiant[f] ?? null
            const current  = (currentEtudiant[f] as string | null) ?? null
            if (incoming !== current) {
              profileUpdate[f] = incoming
              changedFields.push(textFieldLabels[f])
            }
          }
        }
        // dateNaissance: compare as YYYY-MM-DD strings
        if (etudiant.dateNaissance !== undefined) {
          const incomingDate = etudiant.dateNaissance || null
          const currentDate  = currentEtudiant.dateNaissance
            ? (currentEtudiant.dateNaissance as Date | string).toString().slice(0, 10)
            : null
          if (incomingDate !== currentDate) {
            profileUpdate.dateNaissance = incomingDate
              ? new Date(`${incomingDate}T00:00:00.000Z`)
              : null
            changedFields.push("Date de naissance")
          }
        }
        if (Object.keys(profileUpdate).length > 0) {
          await tx.utilisateur.update({ where: { id: existing.etudiantId }, data: profileUpdate })
        }
      }

      // ── Replace diplomes ───────────────────────────────────────────────────
      if (diplomes !== undefined) {
        changedFields.push("Diplômes")
        await tx.diplome.deleteMany({ where: { dossierId: id } })
        if (Array.isArray(diplomes) && diplomes.length > 0) {
          await tx.diplome.createMany({
            data: diplomes.map((d: {
              intitule?: string; annee: number | string; etablissement?: string
              type?: string; sousType?: string; champs?: Record<string, unknown>
            }) => ({
              dossierId:    id,
              intitule:     String(d.intitule ?? "").trim(),
              annee:        Number(d.annee),
              etablissement: d.etablissement ? String(d.etablissement).trim() : null,
              type:          d.type    ?? null,
              sousType:      d.sousType ?? null,
              champs:        d.champs ? (d.champs as object) : undefined,
            })).filter((d: { intitule: string; annee: number }) => !isNaN(d.annee)),
          })
        }
      }

      // ── Update dossier fields ─────────────────────────────────────────────
      const dossierData: Record<string, unknown> = {}
      if (filiereId        !== undefined && (filiereId||null)  !== (existing.filiereId||null))           { dossierData.filiereId        = filiereId||null;                         changedFields.push("Filière") }
      if (niveauEtude      !== undefined && (niveauEtude||null) !== (existing.niveauEtude||null))         { dossierData.niveauEtude      = niveauEtude      as NiveauEtude||null;    changedFields.push("Niveau d'étude") }
      if (typeCours        !== undefined && (typeCours||null)   !== (existing.typeCours||null))           { dossierData.typeCours        = typeCours        as TypeCours  ||null;    changedFields.push("Type de cours") }
      if (sourceDecouverte !== undefined && (sourceDecouverte||null) !== (existing.sourceDecouverte||null)){ dossierData.sourceDecouverte = sourceDecouverte as SourceDecouverte||null; changedFields.push("Source de découverte") }
      if (notes            !== undefined)                                                                  { dossierData.notes            = notes;                                    changedFields.push("Notes") }

      return tx.dossier.update({
        where: { id },
        data: dossierData,
        select: DOSSIER_DETAIL_SELECT,
      })
    })

    // ── Audit log + student notification ──────────────────────────────────
    if (isAdmin && changedFields.length > 0) {
      await logAudit(session.id, id, "ADMIN_EDIT", {
        changedFields,
        diplomesCount: Array.isArray(diplomes) ? diplomes.length : undefined,
      })
      const uniqueFields = [...new Set(changedFields)].slice(0, 4)
      const fieldSummary = uniqueFields.join(", ")
      await createNotification({
        destinataireId: existing.etudiantId,
        type: "DOSSIER_MAJ",
        message: `Votre dossier a été mis à jour par l'administration${fieldSummary ? ` : ${fieldSummary}` : ""}.`,
      })
    }

    return NextResponse.json({ dossier: updated })
  } catch (err) {
    console.error("[PUT /api/dossiers/:id]", err)
    return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 })
  }
}

// ── DELETE /api/dossiers/:id ───────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Non autorisé." }, { status: 401 })

  const { id } = await params

  const existing = await prisma.dossier.findUnique({
    where: { id },
    select: { etudiantId: true, statut: true },
  })
  if (!existing) return NextResponse.json({ error: "Introuvable." }, { status: 404 })

  if (session.role !== "ETUDIANT" || existing.etudiantId !== session.id) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 })
  }
  if (existing.statut !== "BROUILLON") {
    return NextResponse.json(
      { error: "Seuls les brouillons peuvent être supprimés." },
      { status: 422 }
    )
  }

  await prisma.dossier.delete({ where: { id } })
  return NextResponse.json({ message: "Dossier supprimé." })
}
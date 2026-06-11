/**
 * prisma/seed-waitlist.ts
 *
 * Focused seed for testing waitlist promotion logic.
 * Targets Génie Informatique with capacity = 3.
 *
 * State after seed:
 *   Capacity : 3 spots
 *   VALIDE   : 3 (slots full — A, B, C)
 *   ATTENTE  : 3 (rank 1 → 3)
 *   EN_ANALYSE: 1 (can be validated to fill a spot)
 *   SOUMIS   : 1
 *
 * How to test:
 *   1. Admin → Dossiers → pick any VALIDE student → "Révoquer la validation"
 *      → Attente #1 auto-promotes to EN_ANALYSE immediately
 *      → Attente #2 becomes rank 1
 *
 *   2. Go to Admin → Filières → Génie Informatique → Quota
 *      Increase capacity from 3 → 5
 *      → Both Attente #1 and #2 auto-promote to EN_ANALYSE immediately
 *
 * Run: npx ts-node -P tsconfig.seed.json prisma/seed-waitlist.ts
 */

import { PrismaClient, Role } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import bcrypt from "bcryptjs"
import * as dotenv from "dotenv"

dotenv.config()

const pool    = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma  = new PrismaClient({ adapter } as never)

const PASS = "demo1234"
const PDF  = "https://www.w3.org/WAI/WCAG21/Techniques/pdf/sample.pdf"

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d }

async function main() {
  const hashed = await bcrypt.hash(PASS, 12)

  // ── Resolve filière and active year ────────────────────────────────────────
  const filiere = await prisma.filiere.findFirstOrThrow({
    where: { nom: { contains: "Génie Informatique" } },
  })
  const annee = await prisma.anneeAcademique.findFirstOrThrow({
    where: { active: true },
  })

  console.log(`\n🧪  Waitlist seed — ${filiere.nom} · ${annee.libelle}\n`)

  // ── Set capacity to 3 ──────────────────────────────────────────────────────
  await prisma.filiereCapacite.upsert({
    where:  { filiereId_anneeId: { filiereId: filiere.id, anneeId: annee.id } },
    update: { capacite: 3, objectif: 3 },
    create: { filiereId: filiere.id, anneeId: annee.id, capacite: 3, objectif: 3 },
  })
  console.log("  Capacity set to 3\n")

  // ── Student + dossier factory ──────────────────────────────────────────────
  async function mk(
    email: string, prenom: string, nom: string,
    statut: "VALIDE" | "LISTE_ATTENTE" | "EN_ANALYSE" | "SOUMIS",
    avg: number, score: number | null, rang?: number
  ) {
    const student = await prisma.utilisateur.upsert({
      where:  { email },
      update: {},
      create: {
        email, motDePasse: hashed, role: Role.ETUDIANT,
        nom, prenom, sexe: "HOMME", pays: "Tunisie", consentementRGPD: true,
      },
    })

    // Remove any existing dossier for this student in this year so seed is idempotent
    await prisma.dossier.deleteMany({
      where: { etudiantId: student.id, anneeId: annee.id },
    })

    const champs = { math: avg + 1, physique: avg, francais: avg - 2, anglais: avg - 1, informatique: avg + 2, moyenneGenerale: avg }
    const d = await prisma.dossier.create({
      data: {
        etudiantId:       student.id,
        anneeId:          annee.id,
        filiereId:        filiere.id,
        statut,
        score,
        rangListeAttente: rang ?? null,
        niveauEtude:      "BACCALAUREAT",
        typeCours:        "COURS_JOUR",
        sourceDecouverte: "SITE_WEB",
        notes:            champs,
        dateCreation:     daysAgo(Math.floor(Math.random() * 20) + 1),
        diplomes: {
          create: [{
            intitule: "Baccalauréat Scientifique", annee: 2024,
            type: "BAC", sousType: "SCIENTIFIQUE", champs,
          }],
        },
      },
    })

    if (score && (statut === "VALIDE" || statut === "EN_ANALYSE")) {
      await prisma.analyse.create({
        data: {
          dossierId: d.id, score, complet: true,
          resultat:  `Profil évalué — score ${score}/100.`,
          filiereRecommandations: { create: [{ filiereId: filiere.id, rang: 1 }] },
        },
      })
    }

    if (statut === "VALIDE") {
      await prisma.document.createMany({ data: [
        { dossierId: d.id, type: "CNI",         nom: `CNI_${prenom}.jpg`,    url: `https://picsum.photos/seed/${email}/800/600` },
        { dossierId: d.id, type: "DIPLOME",      nom: `BAC_${prenom}.pdf`,   url: PDF },
        { dossierId: d.id, type: "RELEVE_NOTES", nom: `Releve_${prenom}.pdf`,url: PDF },
      ]})
    }

    return { student, dossier: d }
  }

  // ── VALIDE × 3  (fills all 3 spots) ───────────────────────────────────────
  console.log("  Creating 3 VALIDE dossiers (fills capacity)…")
  const { dossier: dA } = await mk("wl.alice@test.tn",   "Alice",   "Karoui",   "VALIDE", 17.5, 91)
  const { dossier: dB } = await mk("wl.bassem@test.tn",  "Bassem",  "Rezgui",   "VALIDE", 16.8, 86)
  const { dossier: dC } = await mk("wl.cyrine@test.tn",  "Cyrine",  "Meddeb",   "VALIDE", 16.0, 82)

  // ── LISTE_ATTENTE × 3 (ranks 1–3) ─────────────────────────────────────────
  console.log("  Creating 3 LISTE_ATTENTE dossiers (ranks 1-2-3)…")
  const { dossier: dW1 } = await mk("wl.dali@test.tn",    "Dali",    "Trabelsi", "LISTE_ATTENTE", 15.5, 78, 1)
  const { dossier: dW2 } = await mk("wl.emna@test.tn",    "Emna",    "Gharbi",   "LISTE_ATTENTE", 14.8, 74, 2)
  const { dossier: dW3 } = await mk("wl.farouk@test.tn",  "Farouk",  "Bettaieb", "LISTE_ATTENTE", 14.2, 70, 3)

  // ── EN_ANALYSE × 1 and SOUMIS × 1 (not yet occupying spots) ──────────────
  console.log("  Creating 1 EN_ANALYSE + 1 SOUMIS dossier…")
  await mk("wl.ghassen@test.tn", "Ghassen", "Dhouib",   "EN_ANALYSE", 13.5, 63)
  await mk("wl.hana@test.tn",    "Hana",    "Belkhir",  "SOUMIS",     13.0, null)

  // ── Print final state ──────────────────────────────────────────────────────
  const valideCount = await prisma.dossier.count({
    where: { filiereId: filiere.id, anneeId: annee.id, statut: "VALIDE" },
  })
  const waitCount = await prisma.dossier.count({
    where: { filiereId: filiere.id, anneeId: annee.id, statut: "LISTE_ATTENTE" },
  })

  console.log(`
✅  Waitlist seed complete!

  Filière : ${filiere.nom}
  Year    : ${annee.libelle}
  Capacity: 3  (VALIDE: ${valideCount} / 3 — FULL)
  Waitlist: ${waitCount} students queued

  ┌─────────────────────────────────────────────────────────────────────┐
  │  EMAIL                 NAME          STATUT           ACTION         │
  ├─────────────────────────────────────────────────────────────────────┤
  │  wl.alice@test.tn      Alice Karoui  VALIDE ★         revoke → free  │
  │  wl.bassem@test.tn     Bassem Rezgui VALIDE ★         revoke → free  │
  │  wl.cyrine@test.tn     Cyrine Meddeb VALIDE ★         revoke → free  │
  │  wl.dali@test.tn       Dali Trabelsi ATTENTE #1  →  promoted on free │
  │  wl.emna@test.tn       Emna Gharbi   ATTENTE #2  →  becomes #1       │
  │  wl.farouk@test.tn     Farouk Bett.  ATTENTE #3  →  becomes #2       │
  │  wl.ghassen@test.tn    Ghassen Dh.   EN_ANALYSE       (no spot yet)  │
  │  wl.hana@test.tn       Hana Belkhir  SOUMIS           (no spot yet)  │
  └─────────────────────────────────────────────────────────────────────┘

  Test 1 — Revoke promotion:
    Admin → Dossiers → Alice (VALIDE) → Révoquer la validation
    Expected: Dali (ATTENTE #1) auto-promotes to EN_ANALYSE

  Test 2 — Capacity increase promotion:
    Admin → Filières → ${filiere.nom} → Quota → change 3 → 5
    Expected: Dali + Emna both auto-promote to EN_ANALYSE immediately

  All passwords: ${PASS}
`)

  // suppress TS unused warnings
  void dA; void dB; void dC; void dW1; void dW2; void dW3
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())

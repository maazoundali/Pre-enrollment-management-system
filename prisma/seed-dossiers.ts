/**
 * prisma/seed-dossiers.ts — ~50 dossiers split across 2024-2025 (archived) and 2025-2026 (active).
 * Run: npx ts-node -P tsconfig.seed.json prisma/seed-dossiers.ts
 *
 * 2024-2025 (archived) — ~20 dossiers, mostly concluded (VALIDE/REJETE), some still EN_ANALYSE.
 * 2025-2026 (active)   — ~30 dossiers, full mix including all feature-testing scenarios.
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
const IMG  = (s: string) => `https://picsum.photos/seed/${s}/800/600`
const AVA  = (n: number) => `https://i.pravatar.cc/150?img=${n}`

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d }
function clamp(v: number)   { return Math.min(20, Math.max(0, Math.round(v * 4) / 4)) }
function jitter(base: number, spread = 2) { return clamp(base + (Math.random() - 0.5) * spread * 2) }

type Serie  = "SCIENTIFIQUE" | "MATHS_INFO" | "TECHNIQUE" | "ECONOMIE" | "LETTRES" | "SPORT"
type Statut = "BROUILLON" | "SOUMIS" | "EN_ANALYSE" | "VALIDE" | "REJETE" | "LISTE_ATTENTE"
type Niveau = "BACCALAUREAT" | "LICENCE_1" | "LICENCE_2" | "LICENCE_3"
type Cours  = "COURS_JOUR" | "COURS_SOIR"
type Source = "AMIS" | "RESEAUX_SOCIAUX" | "SITE_WEB" | "PUBLICITE" | "SALON_ETUDIANT" | "AUTRE"

function grades(serie: Serie, avg: number): Record<string, number> {
  const g = (b: number) => jitter(b)
  switch (serie) {
    case "SCIENTIFIQUE": return { math: g(avg+1), physique: g(avg), francais: g(avg-2), anglais: g(avg), informatique: g(avg+1), moyenneGenerale: avg }
    case "MATHS_INFO":   return { math: g(avg+2), physique: g(avg), informatique: g(avg+2), francais: g(avg-2), anglais: g(avg), moyenneGenerale: avg }
    case "TECHNIQUE":    return { math: g(avg), physique: g(avg+1), francais: g(avg-2), anglais: g(avg-1), informatique: g(avg+1), moyenneGenerale: avg }
    case "ECONOMIE":     return { math: g(avg-1), gestion: g(avg+1), informatique: g(avg), francais: g(avg), anglais: g(avg-1), moyenneGenerale: avg }
    case "LETTRES":      return { francais: g(avg+2), anglais: g(avg+1), philosophie: g(avg), histoire_geo: g(avg), moyenneGenerale: avg }
    case "SPORT":        return { sport: g(avg+3), sciences: g(avg-1), moyenneGenerale: avg }
  }
}

const MOTIFS = [
  "Moyenne générale insuffisante — minimum requis 12/20 pour cette filière.",
  "Dossier incomplet : documents obligatoires manquants.",
  "Profil académique ne correspondant pas aux prérequis du programme.",
  "Notes en mathématiques en dessous du seuil requis.",
]

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const hashed = await bcrypt.hash(PASS, 12)
  console.log("🌱  Seeding dossiers across 2 years…\n")

  // ── Resolve filières & years ──────────────────────────────────────────────
  const allFilieres = await prisma.filiere.findMany()
  const f = (kw: string) => {
    const r = allFilieres.find(x => x.nom.toLowerCase().includes(kw.toLowerCase()))
    if (!r) throw new Error(`Filière not found: ${kw}`)
    return r
  }
  const fInfo    = f("Génie Informatique")
  const fPrepa   = f("Préparatoire")
  const fCivil   = f("Génie Civil")
  const fMeca    = f("Génie Mécanique")
  const fIndustr = f("Génie Industriel")
  const fProced  = f("Génie des Procédés")
  const fTelecom = f("Télécommunications")
  const fArchi   = f("Architecture")
  const fLicInfo = f("Licence Informatique")
  const fLicGI   = f("Licence Génie Industriel")
  const fMaster  = f("Master")

  const admin  = await prisma.utilisateur.findFirstOrThrow({ where: { role: Role.ADMINISTRATEUR } })
  const y2425  = await prisma.anneeAcademique.findFirstOrThrow({ where: { libelle: "2024-2025" } })
  const y2526  = await prisma.anneeAcademique.findFirstOrThrow({ where: { libelle: "2025-2026" } })

  // Set closing date 47 h from now on the active year (deadline reminder test)
  const closingDate = new Date(Date.now() + 47 * 60 * 60 * 1000)
  await prisma.anneeAcademique.update({ where: { id: y2526.id }, data: { dateFermeture: closingDate } })
  console.log(`  2025-2026 closes: ${closingDate.toLocaleString("fr-FR")} (47 h — reminder testing)`)

  // ── Factories ─────────────────────────────────────────────────────────────
  async function mkStudent(email: string, prenom: string, nom: string, sexe: "HOMME"|"FEMME" = "HOMME", tel = "") {
    return prisma.utilisateur.upsert({
      where: { email }, update: {},
      create: { email, motDePasse: hashed, role: Role.ETUDIANT, nom, prenom, sexe, pays: "Tunisie", telephone: tel||null, consentementRGPD: true },
    })
  }

  async function mkDossier(opts: {
    student: { id: string }; filiere: { id: string }; anneeId: string
    statut: Statut; serie: Serie; avg: number
    score?: number|null; niveau?: Niveau; cours?: Cours; source?: Source
    motif?: string; rang?: number; dA?: number
    docs?: boolean; analyse?: boolean; verifiedDocs?: boolean
  }) {
    const champs = grades(opts.serie, opts.avg)
    const d = await prisma.dossier.create({ data: {
      etudiantId: opts.student.id, anneeId: opts.anneeId, filiereId: opts.filiere.id,
      statut: opts.statut, score: opts.score ?? null, motifRejet: opts.motif ?? null,
      rangListeAttente: opts.rang ?? null,
      niveauEtude: opts.niveau ?? "BACCALAUREAT",
      typeCours: opts.cours ?? "COURS_JOUR",
      sourceDecouverte: opts.source ?? "SITE_WEB",
      notes: champs,
      dateCreation: daysAgo(opts.dA ?? Math.floor(Math.random() * 30)),
      diplomes: { create: [{ intitule: `Baccalauréat ${opts.serie}`, annee: opts.anneeId === y2425.id ? 2023 : 2024, type: "BAC", sousType: opts.serie, champs }] },
    }})
    if (opts.docs || opts.verifiedDocs) {
      await prisma.document.createMany({ data: [
        { dossierId: d.id, type: "CNI",         nom: `CNI_${d.id.slice(0,6)}.jpg`,    url: IMG(d.id.slice(0,8)),
          verification: opts.verifiedDocs ? "VERIFIED" : null, verifiedAt: opts.verifiedDocs ? daysAgo(3) : null, verifiedBy: opts.verifiedDocs ? admin.id : null },
        { dossierId: d.id, type: "DIPLOME",      nom: `BAC_${d.id.slice(0,6)}.pdf`,   url: PDF },
        { dossierId: d.id, type: "RELEVE_NOTES", nom: `Releve_${d.id.slice(0,6)}.pdf`,url: PDF },
        { dossierId: d.id, type: "PHOTO",        nom: `Photo_${d.id.slice(0,6)}.jpg`, url: AVA(Math.floor(Math.random()*70)+1) },
      ]})
    }
    if (opts.analyse && opts.score) {
      const s = opts.score
      await prisma.analyse.create({ data: {
        dossierId: d.id, score: s, complet: s >= 50,
        resultat: s >= 75 ? "Profil excellent, candidat fortement recommandé." : s >= 55 ? "Profil satisfaisant, candidat acceptable." : "Profil insuffisant pour ce programme.",
        filiereRecommandations: { create: [{ filiereId: opts.filiere.id, rang: 1 }] },
      }})
    }
    return d
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ANNÉE 2024-2025 (archived) — concluded dossiers
  //  Mostly VALIDE + REJETE, some EN_ANALYSE still being processed
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n  ── 2024-2025 (archived) ──────────────────────────")

  // Students who studied in 2024-2025 (some will reapply in 2025-2026 with different emails)
  const sKhaled   = await mkStudent("khaled@test.tn",   "Khaled",   "Bouazizi",  "HOMME")
  const sAmine    = await mkStudent("amine@test.tn",    "Amine",    "Riahi",     "HOMME")
  const sInes     = await mkStudent("ines@test.tn",     "Ines",     "Ayari",     "FEMME")
  const sHatem    = await mkStudent("hatem@test.tn",    "Hatem",    "Ghanmi",    "HOMME")
  const sSalma    = await mkStudent("salma@test.tn",    "Salma",    "Mejri",     "FEMME")
  const sTarek    = await mkStudent("tarek@test.tn",    "Tarek",    "Maaouia",   "HOMME")
  const sMarouane = await mkStudent("marouane@test.tn", "Marouane", "Hajji",     "HOMME")
  const sOlfa     = await mkStudent("olfa@test.tn",     "Olfa",     "Turki",     "FEMME")
  const sFares    = await mkStudent("fares@test.tn",    "Fares",    "Zayani",    "HOMME")
  const sAdel     = await mkStudent("adel@test.tn",     "Adel",     "Jerbi",     "HOMME")
  const sRim      = await mkStudent("rim@test.tn",      "Rim",      "Ayed",      "FEMME")
  const sAfef     = await mkStudent("afef@test.tn",     "Afef",     "Hamdi",     "FEMME")
  const sMabrouk  = await mkStudent("mabrouk@test.tn",  "Mabrouk",  "Tlili",     "HOMME")
  const sYoussef2 = await mkStudent("youssef2@test.tn", "Youssef",  "Ben Amor",  "HOMME")
  const sNabila   = await mkStudent("nabila@test.tn",   "Nabila",   "Fakhfakh",  "FEMME")
  const sWissem   = await mkStudent("wissem@test.tn",   "Wissem",   "Driss",     "HOMME")
  const sChiheb   = await mkStudent("chiheb@test.tn",   "Chiheb",   "Derbel",    "HOMME")
  const sMontacer = await mkStudent("montacer@test.tn", "Montacer", "Jebali",    "HOMME")

  const Y1 = y2425.id

  // Génie Informatique 2024-2025
  console.log("    Génie Informatique (2024-2025)")
  await mkDossier({ student: sKhaled,  filiere: fInfo,   anneeId: Y1, statut: "VALIDE",     serie: "MATHS_INFO",   avg: 16.8, score: 85, docs: true, verifiedDocs: true, analyse: true, dA: 280 })
  await mkDossier({ student: sAmine,   filiere: fInfo,   anneeId: Y1, statut: "VALIDE",     serie: "SCIENTIFIQUE", avg: 15.5, score: 77, docs: true, verifiedDocs: true, analyse: true, dA: 270 })
  await mkDossier({ student: sInes,    filiere: fInfo,   anneeId: Y1, statut: "VALIDE",     serie: "MATHS_INFO",   avg: 18.0, score: 92, docs: true, verifiedDocs: true, analyse: true, dA: 260 })
  await mkDossier({ student: sWissem,  filiere: fInfo,   anneeId: Y1, statut: "REJETE",     serie: "ECONOMIE",     avg: 10.5, score: 38, motif: MOTIFS[0], dA: 265 })
  await mkDossier({ student: sNabila,  filiere: fInfo,   anneeId: Y1, statut: "EN_ANALYSE", serie: "SCIENTIFIQUE", avg: 14.2, score: 67, analyse: true, dA: 258 })

  // Cycle Préparatoire 2024-2025
  console.log("    Cycle Préparatoire (2024-2025)")
  await mkDossier({ student: sHatem,   filiere: fPrepa,  anneeId: Y1, statut: "VALIDE",     serie: "SCIENTIFIQUE", avg: 18.5, score: 93, docs: true, verifiedDocs: true, analyse: true, dA: 275 })
  await mkDossier({ student: sSalma,   filiere: fPrepa,  anneeId: Y1, statut: "VALIDE",     serie: "MATHS_INFO",   avg: 17.0, score: 86, docs: true, verifiedDocs: true, analyse: true, dA: 268 })
  await mkDossier({ student: sChiheb,  filiere: fPrepa,  anneeId: Y1, statut: "REJETE",     serie: "LETTRES",      avg: 11.5, score: 42, motif: MOTIFS[2], dA: 272 })

  // Génie Civil 2024-2025
  console.log("    Génie Civil (2024-2025)")
  await mkDossier({ student: sTarek,   filiere: fCivil,  anneeId: Y1, statut: "VALIDE",     serie: "TECHNIQUE",    avg: 15.0, score: 74, docs: true, verifiedDocs: true, analyse: true, dA: 277 })
  await mkDossier({ student: sMontacer,filiere: fCivil,  anneeId: Y1, statut: "REJETE",     serie: "ECONOMIE",     avg: 11.0, score: 40, motif: MOTIFS[0], dA: 271 })

  // Génie Mécanique 2024-2025
  console.log("    Génie Mécanique / Industriel / Télécoms (2024-2025)")
  await mkDossier({ student: sMarouane,filiere: fMeca,   anneeId: Y1, statut: "VALIDE",     serie: "TECHNIQUE",    avg: 15.5, score: 78, docs: true, verifiedDocs: true, analyse: true, dA: 276 })
  await mkDossier({ student: sOlfa,    filiere: fMeca,   anneeId: Y1, statut: "VALIDE",     serie: "SCIENTIFIQUE", avg: 14.8, score: 72, docs: true, verifiedDocs: true, analyse: true, dA: 267 })
  await mkDossier({ student: sFares,   filiere: fIndustr,anneeId: Y1, statut: "VALIDE",     serie: "TECHNIQUE",    avg: 14.5, score: 71, docs: true, verifiedDocs: true, analyse: true, dA: 273 })
  await mkDossier({ student: sAdel,    filiere: fTelecom,anneeId: Y1, statut: "VALIDE",     serie: "MATHS_INFO",   avg: 16.5, score: 83, docs: true, verifiedDocs: true, analyse: true, dA: 262 })

  // Architecture / Licences / Master 2024-2025
  console.log("    Architecture / Licences / Master (2024-2025)")
  await mkDossier({ student: sRim,     filiere: fArchi,  anneeId: Y1, statut: "VALIDE",     serie: "LETTRES",      avg: 16.5, score: 80, docs: true, verifiedDocs: true, analyse: true, dA: 279 })
  await mkDossier({ student: sAfef,    filiere: fLicInfo,anneeId: Y1, statut: "VALIDE",     serie: "MATHS_INFO",   avg: 15.0, score: 73, docs: true, verifiedDocs: true, analyse: true, dA: 269 })
  await mkDossier({ student: sMabrouk, filiere: fLicGI,  anneeId: Y1, statut: "VALIDE",     serie: "ECONOMIE",     avg: 14.2, score: 69, docs: true, verifiedDocs: true, analyse: true, dA: 274 })

  // Master (Licence 3 level)
  const dYoussef2 = await prisma.dossier.create({ data: {
    etudiantId: sYoussef2.id, anneeId: Y1, filiereId: fMaster.id,
    statut: "VALIDE", score: 82, niveauEtude: "LICENCE_3", typeCours: "COURS_JOUR", sourceDecouverte: "SITE_WEB",
    notes: { moyenneGenerale: 15.8 }, dateCreation: daysAgo(278),
    diplomes: { create: [{ intitule: "Licence Génie Industriel", annee: 2022, type: "LICENCE", champs: { moyenneGenerale: 15.8 } }] },
  }})
  await prisma.analyse.create({ data: { dossierId: dYoussef2.id, score: 82, complet: true, resultat: "Profil Master solide.", filiereRecommandations: { create: [{ filiereId: fMaster.id, rang: 1 }] } } })

  const count2425 = await prisma.dossier.count({ where: { anneeId: Y1 } })
  console.log(`    → ${count2425} dossiers created for 2024-2025`)

  // ══════════════════════════════════════════════════════════════════════════
  //  ANNÉE 2025-2026 (active) — full mix, all feature-testing scenarios
  // ══════════════════════════════════════════════════════════════════════════
  console.log("\n  ── 2025-2026 (active) ───────────────────────────")

  const Y2 = y2526.id

  // Original key students
  const sMohamed = await mkStudent("mohamed@test.tn", "Mohamed", "Khelifi",   "HOMME", "+216 20 111 003")
  const sNour    = await mkStudent("nour@test.tn",    "Nour",    "Zouari",    "FEMME", "+216 20 111 004")
  const sSarra   = await mkStudent("sarra@test.tn",   "Sarra",   "Mansouri",  "FEMME", "+216 20 111 005")
  const sAhmed   = await mkStudent("ahmed@test.tn",   "Ahmed",   "Ben Ali",   "HOMME", "+216 20 111 001")
  const sFatma   = await mkStudent("fatma@test.tn",   "Fatma",   "Trabelsi",  "FEMME", "+216 20 111 002")
  const sKarim   = await mkStudent("karim@test.tn",   "Karim",   "Jebali",    "HOMME", "+216 20 111 006")
  const sLeila   = await mkStudent("leila@test.tn",   "Leila",   "Hamrouni",  "FEMME", "+216 20 111 007")
  const sBilel   = await mkStudent("bilel@test.tn",   "Bilel",   "Chaabane",  "HOMME", "+216 20 111 008")
  const sAmira   = await mkStudent("amira@test.tn",   "Amira",   "Ferchichi", "FEMME", "+216 20 111 009")
  const sRania   = await mkStudent("rania@test.tn",   "Rania",   "Gharbi",    "FEMME", "+216 20 111 010")
  const sYassine = await mkStudent("yassine@test.tn", "Yassine", "Chatti",    "HOMME", "+216 20 111 011")
  const sOmar    = await mkStudent("omar@test.tn",    "Omar",    "Sassi",     "HOMME", "+216 20 111 012")

  // Additional 2025-2026 students
  const sAyoub   = await mkStudent("ayoub@test.tn",   "Ayoub",   "Khalfallah","HOMME")
  const sMariem  = await mkStudent("mariem@test.tn",  "Mariem",  "Haddad",    "FEMME")
  const sSkander = await mkStudent("skander@test.tn", "Skander", "Fakhfakh",  "HOMME")
  const sZied    = await mkStudent("zied@test.tn",    "Zied",    "Korbi",     "HOMME")
  const sNesrine = await mkStudent("nesrine@test.tn", "Nesrine", "Lahmar",    "FEMME")
  const sHoussem = await mkStudent("houssem@test.tn", "Houssem", "Karray",    "HOMME")
  const sYasmine = await mkStudent("yasmine@test.tn", "Yasmine", "Rekik",     "FEMME")
  const sAchraf  = await mkStudent("achraf@test.tn",  "Achraf",  "Slim",      "HOMME")
  const sHajer   = await mkStudent("hajer@test.tn",   "Hajer",   "Mabrouki",  "FEMME")
  const sWalid   = await mkStudent("walid@test.tn",   "Walid",   "Nasr",      "HOMME")
  const sWafa    = await mkStudent("wafa@test.tn",    "Wafa",    "Belhaj",    "FEMME")
  const sMounir  = await mkStudent("mounir@test.tn",  "Mounir",  "Mrabet",    "HOMME")
  const sLotfi   = await mkStudent("lotfi@test.tn",   "Lotfi",   "Tlili",     "HOMME")
  const sEmna    = await mkStudent("emna@test.tn",    "Emna",    "Lazaar",    "FEMME")
  const sHedi    = await mkStudent("hedi@test.tn",    "Hedi",    "Mhamdi",    "HOMME")
  const sLina    = await mkStudent("lina@test.tn",    "Lina",    "Hamdi",     "FEMME")
  const sTaoufik = await mkStudent("taoufik@test.tn", "Taoufik", "Ayed",      "HOMME")

  // ── Génie Informatique 2025-2026 ─────────────────────────────────────────
  console.log("    Génie Informatique (2025-2026)")
  const dMohamed = await mkDossier({ student: sMohamed, filiere: fInfo, anneeId: Y2, statut: "VALIDE",       serie: "SCIENTIFIQUE", avg: 17.2, score: 88, docs: true, verifiedDocs: true, analyse: true, dA: 20 })
  const dNour    = await mkDossier({ student: sNour,    filiere: fInfo, anneeId: Y2, statut: "LISTE_ATTENTE", serie: "SCIENTIFIQUE", avg: 16.4, score: 81, rang: 1,  dA: 19 })
  const dSarra   = await mkDossier({ student: sSarra,   filiere: fInfo, anneeId: Y2, statut: "LISTE_ATTENTE", serie: "MATHS_INFO",   avg: 15.8, score: 79, rang: 2,  dA: 18 })
  const dAhmed   = await mkDossier({ student: sAhmed,   filiere: fInfo, anneeId: Y2, statut: "SOUMIS",        serie: "SCIENTIFIQUE", avg: 15.2, docs: true, dA: 8  })
  const dFatma   = await mkDossier({ student: sFatma,   filiere: fInfo, anneeId: Y2, statut: "EN_ANALYSE",    serie: "MATHS_INFO",   avg: 16.0, score: 72, analyse: true, cours: "COURS_SOIR", dA: 12 })
  await mkDossier({ student: sAyoub,   filiere: fInfo, anneeId: Y2, statut: "EN_ANALYSE",  serie: "SCIENTIFIQUE", avg: 14.5, score: 68, analyse: true, dA: 10 })
  await mkDossier({ student: sMariem,  filiere: fInfo, anneeId: Y2, statut: "SOUMIS",      serie: "MATHS_INFO",   avg: 17.5, docs: true, dA: 5 })
  await mkDossier({ student: sSkander, filiere: fInfo, anneeId: Y2, statut: "BROUILLON",   serie: "SCIENTIFIQUE", avg: 13.0, dA: 2 })

  // ── Cycle Préparatoire 2025-2026 ─────────────────────────────────────────
  console.log("    Cycle Préparatoire (2025-2026)")
  // Leila — EN_ANALYSE with 4 docs in different verification states (feature test)
  const dLeila = await mkDossier({ student: sLeila, filiere: fPrepa, anneeId: Y2, statut: "EN_ANALYSE", serie: "SCIENTIFIQUE", avg: 14.6, score: 74, dA: 15 })
  await prisma.document.createMany({ data: [
    { dossierId: dLeila.id, type: "CNI",         nom: "CNI_Leila.jpg",    url: IMG("cni-leila"),  verification: "VERIFIED",       verificationNote: null,                             verifiedAt: daysAgo(5), verifiedBy: admin.id },
    { dossierId: dLeila.id, type: "DIPLOME",      nom: "BAC_Leila.pdf",   url: PDF,               verification: "REJECTED",       verificationNote: "Document illisible — renvoyer.", verifiedAt: daysAgo(4), verifiedBy: admin.id },
    { dossierId: dLeila.id, type: "RELEVE_NOTES", nom: "Releve_Leila.pdf",url: PDF,               verification: "NEEDS_REUPLOAD", verificationNote: "Qualité insuffisante.",          verifiedAt: daysAgo(3), verifiedBy: admin.id },
    { dossierId: dLeila.id, type: "PHOTO",        nom: "Photo_Leila.jpg", url: AVA(47),           verification: null,             verificationNote: null },
  ]})

  await mkDossier({ student: sKarim,   filiere: fPrepa, anneeId: Y2, statut: "REJETE",    serie: "TECHNIQUE",    avg: 10.5, score: 41, motif: MOTIFS[0], dA: 25 })
  await mkDossier({ student: sYassine, filiere: fPrepa, anneeId: Y2, statut: "BROUILLON", serie: "MATHS_INFO",   avg: 16.2, dA: 1 })
  await mkDossier({ student: sZied,    filiere: fPrepa, anneeId: Y2, statut: "EN_ANALYSE",serie: "SCIENTIFIQUE", avg: 15.5, score: 76, analyse: true, dA: 9 })
  await mkDossier({ student: sNesrine, filiere: fPrepa, anneeId: Y2, statut: "SOUMIS",    serie: "SCIENTIFIQUE", avg: 14.0, docs: true, dA: 5 })
  await mkDossier({ student: sHoussem, filiere: fPrepa, anneeId: Y2, statut: "BROUILLON", serie: "MATHS_INFO",   avg: 13.5, dA: 3 })

  // ── Génie Civil 2025-2026 ─────────────────────────────────────────────────
  console.log("    Génie Civil / Mécanique / Industriel (2025-2026)")
  await mkDossier({ student: sOmar,    filiere: fCivil,  anneeId: Y2, statut: "SOUMIS",    serie: "TECHNIQUE",    avg: 13.8, docs: true, dA: 6  })
  await mkDossier({ student: sRania,   filiere: fCivil,  anneeId: Y2, statut: "BROUILLON", serie: "SCIENTIFIQUE", avg: 13.6, dA: 2 })
  await mkDossier({ student: sYasmine, filiere: fCivil,  anneeId: Y2, statut: "EN_ANALYSE",serie: "SCIENTIFIQUE", avg: 14.2, score: 66, analyse: true, dA: 11 })

  await mkDossier({ student: sAchraf,  filiere: fMeca,   anneeId: Y2, statut: "SOUMIS",    serie: "TECHNIQUE",    avg: 13.5, docs: true, dA: 9  })
  await mkDossier({ student: sHajer,   filiere: fMeca,   anneeId: Y2, statut: "BROUILLON", serie: "SCIENTIFIQUE", avg: 12.8, dA: 4 })

  await mkDossier({ student: sWalid,   filiere: fIndustr,anneeId: Y2, statut: "SOUMIS",    serie: "ECONOMIE",     avg: 12.0, docs: true, dA: 8  })
  await mkDossier({ student: sLotfi,   filiere: fIndustr,anneeId: Y2, statut: "BROUILLON", serie: "SCIENTIFIQUE", avg: 13.2, dA: 3 })

  // ── Génie des Procédés / Télécoms / Architecture 2025-2026 ───────────────
  console.log("    Procédés / Télécoms / Architecture (2025-2026)")
  await mkDossier({ student: sHedi,    filiere: fProced, anneeId: Y2, statut: "SOUMIS",    serie: "SCIENTIFIQUE", avg: 13.0, docs: true, dA: 10 })
  await mkDossier({ student: sWafa,    filiere: fTelecom,anneeId: Y2, statut: "EN_ANALYSE",serie: "MATHS_INFO",   avg: 15.0, score: 73, analyse: true, dA: 12 })
  await mkDossier({ student: sMounir,  filiere: fArchi,  anneeId: Y2, statut: "EN_ANALYSE",serie: "LETTRES",      avg: 14.0, score: 67, analyse: true, dA: 11 })
  await mkDossier({ student: sEmna,    filiere: fArchi,  anneeId: Y2, statut: "BROUILLON", serie: "LETTRES",      avg: 13.5, dA: 4 })

  // ── Licences / Master 2025-2026 ───────────────────────────────────────────
  console.log("    Licences / Master (2025-2026)")
  await mkDossier({ student: sBilel,   filiere: fLicInfo,anneeId: Y2, statut: "BROUILLON", serie: "ECONOMIE",     avg: 13.5, source: "SITE_WEB", dA: 3 })
  await mkDossier({ student: sTaoufik, filiere: fLicInfo,anneeId: Y2, statut: "SOUMIS",    serie: "MATHS_INFO",   avg: 14.2, docs: true, dA: 6 })
  await mkDossier({ student: sAmira,   filiere: fLicGI,  anneeId: Y2, statut: "BROUILLON", serie: "ECONOMIE",     avg: 13.0, source: "SALON_ETUDIANT", dA: 5 })

  // Master 2025-2026 (Licence 3 students)
  const dLina = await prisma.dossier.create({ data: {
    etudiantId: sLina.id, anneeId: Y2, filiereId: fMaster.id,
    statut: "EN_ANALYSE", score: 70, niveauEtude: "LICENCE_3", typeCours: "COURS_JOUR", sourceDecouverte: "SITE_WEB",
    notes: { moyenneGenerale: 14.5 }, dateCreation: daysAgo(14),
    diplomes: { create: [{ intitule: "Licence Génie Industriel", annee: 2023, type: "LICENCE", champs: { moyenneGenerale: 14.5 } }] },
  }})
  await prisma.analyse.create({ data: { dossierId: dLina.id, score: 70, complet: true, resultat: "Profil acceptable pour le Master.", filiereRecommandations: { create: [{ filiereId: fMaster.id, rang: 1 }] } } })

  // ── Summary ───────────────────────────────────────────────────────────────
  const c2425 = await prisma.dossier.count({ where: { anneeId: Y1 } })
  const c2526 = await prisma.dossier.count({ where: { anneeId: Y2 } })
  const docs  = await prisma.document.count()

  console.log(`\n✅  Done!`)
  console.log(`  2024-2025 (archived): ${c2425} dossiers — mostly VALIDE/REJETE`)
  console.log(`  2025-2026 (active):   ${c2526} dossiers — full workflow mix`)
  console.log(`  Total documents: ${docs}`)
  console.log(`  Enrollment closes: ${closingDate.toLocaleString("fr-FR")} (47 h)\n`)

  console.log("  Key accounts (password: demo1234)")
  console.log("  ┌───────────────────────────────────────────────────────────────┐")
  console.log("  │  mohamed@test.tn  VALIDE ★ 2025-2026  → revoke for waitlist   │")
  console.log("  │  nour@test.tn     ATTENTE #1           → auto-promoted         │")
  console.log("  │  leila@test.tn    EN_ANALYSE docs       → 4-state verification │")
  console.log("  │  bilel/amira/rania/yassine/skander/houssem/emna → BROUILLON    │")
  console.log("  │  khaled/ines/hatem/rim … → VALIDE in 2024-2025 (archived)     │")
  console.log("  └───────────────────────────────────────────────────────────────┘")

  // suppress unused-variable warnings
  void dMohamed; void dNour; void dSarra; void dAhmed; void dFatma; void dLeila; void dLina
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())

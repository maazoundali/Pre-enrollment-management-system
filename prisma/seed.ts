// prisma/seed.ts — admin + supervisor + filières + initial academic year
import { PrismaClient, Role } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import bcrypt from "bcryptjs"
import * as dotenv from "dotenv"
dotenv.config()

const pool    = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma  = new PrismaClient({ adapter } as never)

async function main() {
  const PASSWORD = await bcrypt.hash("demo1234", 12)
  console.log("🌱  Seeding database…")

  await prisma.adminFiliere.deleteMany()
  await prisma.filiereCapacite.deleteMany()
  await prisma.filiere.deleteMany()
  await prisma.anneeAcademique.deleteMany()
  await prisma.utilisateur.deleteMany({ where: { role: { in: [Role.ADMINISTRATEUR, Role.SUPERVISEUR] } } })

  // ── Academic years — 2024-2025 archived, 2025-2026 active ───────────────
  const annee2425 = await prisma.anneeAcademique.create({
    data: {
      libelle:       "2024-2025",
      active:        false,
      archivee:      true,
      dateOuverture: new Date("2024-09-01T00:00:00.000Z"),
      dateFermeture: new Date("2025-06-30T23:59:59.000Z"),
    },
  })
  const annee2526 = await prisma.anneeAcademique.create({
    data: {
      libelle:       "2025-2026",
      active:        true,
      archivee:      false,
      dateOuverture: new Date("2025-09-01T00:00:00.000Z"),
      dateFermeture: new Date("2026-06-30T23:59:59.000Z"),
    },
  })
  console.log(`  Academic years: ${annee2425.libelle} (archived) · ${annee2526.libelle} (active)`)
  const annee = annee2526   // alias for the FiliereCapacite block below

  // ── Filières (without capacite — now managed per year) ────────────────────
  const FILIERES = [
    { nom: "Génie Informatique",                           description: "Formation en développement logiciel, systèmes embarqués et réseaux.",                        duree: "3 ans", diplomeDelivre: "Ingénierie",    langue: "Français",          fraisInscription: 1800, categorie: "ingenierie",    programme: "Algorithmique · Bases de données · Développement web · Réseaux · IA · PFE",      capacite: 60, objectif: 50 },
    { nom: "Génie Civil",                                  description: "Construction, structures, topographie et gestion de chantier.",                              duree: "3 ans", diplomeDelivre: "Ingénierie",    langue: "Français",          fraisInscription: 1700, categorie: "ingenierie",    programme: "Résistance des matériaux · Béton armé · Topographie · Géotechnique · AutoCAD",    capacite: 35, objectif: 30 },
    { nom: "Génie des Procédés",                           description: "Procédés industriels, chimie appliquée et génie de l'environnement.",                       duree: "3 ans", diplomeDelivre: "Ingénierie",    langue: "Français",          fraisInscription: 1700, categorie: "ingenierie",    programme: null,                                                                              capacite: 30, objectif: 25 },
    { nom: "Génie Mécanique",                              description: "Conception mécanique, fabrication et maintenance industrielle.",                             duree: "3 ans", diplomeDelivre: "Ingénierie",    langue: "Français",          fraisInscription: 1700, categorie: "ingenierie",    programme: null,                                                                              capacite: 35, objectif: 30 },
    { nom: "Génie Industriel",                             description: "Management des systèmes de production et logistique.",                                       duree: "3 ans", diplomeDelivre: "Ingénierie",    langue: "Français",          fraisInscription: 1700, categorie: "ingenierie",    programme: null,                                                                              capacite: 40, objectif: 35 },
    { nom: "Génie des Télécommunications",                 description: "Réseaux, systèmes de communication et traitement du signal.",                               duree: "3 ans", diplomeDelivre: "Ingénierie",    langue: "Français",          fraisInscription: 1800, categorie: "ingenierie",    programme: null,                                                                              capacite: 30, objectif: 25 },
    { nom: "Architecture",                                 description: "Conception architecturale, urbanisme et patrimoine.",                                        duree: "5 ans", diplomeDelivre: "Architecture",  langue: "Français",          fraisInscription: 2000, categorie: "architecture",  programme: null,                                                                              capacite: 25, objectif: 20 },
    { nom: "Cycle Préparatoire",                           description: "Formation scientifique intensive préparant aux grandes écoles d'ingénieurs.",               duree: "2 ans", diplomeDelivre: "Préparatoire",  langue: "Français",          fraisInscription: 1500, categorie: "preparatoire",  programme: null,                                                                              capacite: 80, objectif: 70 },
    { nom: "Licence Informatique — Génie Logiciel et SI",  description: "Licence professionnelle axée sur le développement logiciel et les systèmes d'information.", duree: "3 ans", diplomeDelivre: "Licence",       langue: "Français",          fraisInscription: 1400, categorie: "licence",       programme: null,                                                                              capacite: 50, objectif: 45 },
    { nom: "Licence Génie Industriel — Management des SI", description: "Licence orientée management des systèmes industriels et production.",                       duree: "3 ans", diplomeDelivre: "Licence",       langue: "Français",          fraisInscription: 1400, categorie: "licence",       programme: null,                                                                              capacite: 45, objectif: 40 },
    { nom: "Master Industrie V4.0",                        description: "Master spécialisé dans l'industrie du futur, IoT, automatisation et transformation digitale.", duree: "2 ans", diplomeDelivre: "Master",    langue: "Français / Anglais", fraisInscription: 2200, categorie: "master",        programme: null,                                                                              capacite: 25, objectif: 20 },
  ]

  const filieres = await Promise.all(
    FILIERES.map(({ capacite, objectif, ...data }) => prisma.filiere.create({ data }))
  )

  // Create FiliereCapacite for both years
  await prisma.filiereCapacite.createMany({
    data: [
      // 2024-2025 (slightly lower capacities — past year)
      ...filieres.map((f, i) => ({
        filiereId: f.id, anneeId: annee2425.id,
        capacite:  Math.max(1, FILIERES[i].capacite - 5),
        objectif:  Math.max(1, (FILIERES[i].objectif ?? FILIERES[i].capacite) - 5),
      })),
      // 2025-2026 (current year)
      ...filieres.map((f, i) => ({
        filiereId: f.id, anneeId: annee2526.id,
        capacite:  FILIERES[i].capacite,
        objectif:  FILIERES[i].objectif,
      })),
    ],
  })

  // ── Admin ─────────────────────────────────────────────────────────────────
  const admin = await prisma.utilisateur.create({
    data: {
      email: "admin@portail.tn", motDePasse: PASSWORD,
      role: Role.ADMINISTRATEUR, nom: "Mansouri", prenom: "Karim", departement: "Direction des études",
    },
  })
  await prisma.adminFiliere.createMany({
    data: filieres.map((f) => ({ administrateurId: admin.id, filiereId: f.id })),
  })

  // ── Supervisor ────────────────────────────────────────────────────────────
  await prisma.utilisateur.create({
    data: {
      email: "superviseur@portail.tn", motDePasse: PASSWORD,
      role: Role.SUPERVISEUR, nom: "Hamdi", prenom: "Sonia", niveauAcces: 1,
    },
  })

  console.log("\n✅  Seed complete!\n")
  console.log("  admin@portail.tn        → Admin        (password: demo1234)")
  console.log("  superviseur@portail.tn  → Superviseur  (password: demo1234)")
  console.log(`  ${filieres.length} filières · quotas created for both years`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())

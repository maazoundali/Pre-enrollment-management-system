/**
 * prisma/backfill-avatars.ts
 *
 * One-time backfill: for every user who already has a PHOTO document uploaded,
 * set their avatarUrl to the most recent photo URL.
 *
 * Run once with:
 *   npx tsx prisma/backfill-avatars.ts
 */

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env" })
dotenv.config({ path: ".env.local", override: false })

const pool    = new Pool({ connectionString: process.env.DATABASE_URL! })
const adapter = new PrismaPg(pool)
const prisma  = new PrismaClient({ adapter })

async function main() {
  // Find each user's most recent PHOTO document
  const photos = await prisma.document.findMany({
    where: { type: "PHOTO" },
    orderBy: { dateUpload: "desc" },
    select: {
      url: true,
      dateUpload: true,
      dossier: { select: { etudiantId: true } },
    },
  })

  // Keep only the newest photo per user
  const latestByUser = new Map<string, string>()
  for (const p of photos) {
    const userId = p.dossier.etudiantId
    if (!latestByUser.has(userId)) {
      latestByUser.set(userId, p.url)
    }
  }

  if (latestByUser.size === 0) {
    console.log("No PHOTO documents found — nothing to backfill.")
    return
  }

  let updated = 0
  for (const [userId, url] of latestByUser) {
    await prisma.utilisateur.update({
      where: { id: userId },
      data:  { avatarUrl: url },
    })
    updated++
    console.log(`  ✓ User ${userId.slice(0, 8)}… → ${url}`)
  }

  console.log(`\nDone. ${updated} user(s) updated.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

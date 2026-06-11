// prisma.config.ts  (project root — NOT inside /prisma folder)
import path from "node:path"
import { defineConfig } from "prisma/config"
import * as dotenv from "dotenv"

// Prisma reads .env automatically but NOT .env.local
// This ensures DATABASE_URL is always available
dotenv.config({ path: ".env" })
dotenv.config({ path: ".env.local", override: false })

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
})
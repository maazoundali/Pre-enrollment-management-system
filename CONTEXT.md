# IIT Pre-Enrollment Portal — Project Context

This document is the single source of truth for anyone (human or AI) picking up this codebase. Read it before touching anything.

---

## What This Is

A **university pre-enrollment portal** built for IIT (Institut International de Technologie), Tunisia. Students create application dossiers online, upload documents, get OCR-extracted grades and AI-powered program recommendations, and track their application status. Admins review, batch-process, and decide on applications. Supervisors monitor analytics and leave internal notes. The whole system uses a local Ollama stack for AI — no external API costs.

**Live stack:** Next.js 16.2, PostgreSQL, Prisma 7 with `@prisma/adapter-pg`, JWT auth via `jose`, Tesseract.js + minicpm-v for OCR, Mistral for analysis and chatbot, jsPDF for export, nodemailer for emails.

---

## Critical Gotchas

### After any `prisma db push` → MUST restart the dev server
The Prisma singleton (`lib/prisma.ts`) caches the client in `globalThis`. Hot reload does NOT clear it. New models will be `undefined` until the server process restarts. This is the #1 cause of mysterious `Cannot read properties of undefined` errors.

```bash
npx prisma db push
npx prisma generate
# Then: Ctrl+C and npm run dev
```

### Prisma adapter — no raw `new PrismaClient()` anywhere
This project uses `@prisma/adapter-pg`. Always import from `lib/prisma.ts`. Never instantiate `PrismaClient` directly.

### Next.js 16 — App Router only, no Pages Router
All routes are in `app/`. No `pages/` directory. Route groups use `(auth)`, `(student)`, `(admin)`, `(supervisor)`. Params are `Promise<{ id: string }>` — always `await params`.

### Identity documents: PDF only
CIN and Passport uploads are restricted to `.pdf` on both client (`accept=".pdf,application/pdf"`) and server (magic-byte check). OCR handles PDF→canvas via pdfjs-dist.

### Arabic text in jsPDF
jsPDF uses Helvetica — it cannot render Arabic. Any string going into the PDF must pass through `sanitize()` in `lib/generatePDF.ts` which strips Arabic Unicode ranges. The PDF shows "—" for empty sanitized strings.

### Filière capacity is NOT on the Filiere model
There is no `capacite` column on `Filiere`. Capacity is stored per-year in the `FiliereCapacite` table (`filiereId` + `anneeId` + `capacite`). Always use `getActiveAnnee()` from `lib/annee.ts` to resolve the year, then join `capacites` with `{ where: { anneeId: annee.id } }`. Stats and waitlist logic both follow this pattern.

### PDF file preview vs. image preview
`URL.createObjectURL(pdfFile)` produces a blob URL that `<img>` cannot render. For the ID card scan preview in `profile/complete`, the preview is set to `imageBase64` (the PNG rendered by pdfjs-dist after conversion) — not the blob URL. Blob URLs are only used for cleanup tracking and must be revoked in `useEffect` cleanup.

---

## Architecture Decisions

### Auth
- JWT signed with `jose`, stored in httpOnly cookie named `token`, 7-day expiry.
- `middleware.ts` validates at edge — no DB call per request.
- Login API returns the **full user object** including `avatarUrl` so the sidebar has it immediately without a round-trip.
- Password reset: `PasswordReset` table, 32-byte random token, 1-hour expiry, single-use (`usedAt` timestamp).

### Academic Year System
`AnneeAcademique` is the central time axis of the system. Every `Dossier` is tied to an `anneeId`. Capacity is per-year via `FiliereCapacite` (`filiereId` + `anneeId` + `capacite` hard cap + optional `objectif` soft target).

Key rules:
- Only one year can be `active = true` at a time — enforced in the admin UI and the activate PATCH handler.
- `lib/annee.ts` exports `getActiveAnnee()` — used everywhere that needs the current year.
- `GET /api/annees` is accessible to all authenticated roles (admin, supervisor, student) — it returns `{ id, libelle, active, archivee }` only, no admin-only fields.
- `GET /api/admin/annees` is admin-only and returns the full record including dates.
- `GET /api/admin/stats?anneeId=X` filters all aggregates (dossier counts, parStatut, filieres fill rate, recentDossiers, scoreMoyen) by the given year. Falls back to active year when omitted.

### Data Flow — Grades
Grades live in two places simultaneously (by design):
1. `Diplome.champs` (JSON) — the authoritative per-diploma grades
2. `Dossier.notes` (JSON) — a merged mirror of all grades, written by `handleSaveAcademic`

The analyser reads `mergedNotes = { ...dossierNotes, ...gradesFromDiplomas }` — diplomas win on conflict. The `notes` mirror exists as a backup for cases where diplomas are saved without a year (would otherwise be filtered out).

Known grade key: `moyenneGenerale` (camelCase) — all diploma types use this. Both `moyennegenerale` and `moyenneGenerale` are accepted via alias maps.

### Filière Eligibility (two layers)
1. **Real-time recs** (`recommend-preview/route.ts`) — imports `isEligibleFiliere` from `lib/quick-recommend.ts`, hard-filters before scoring.
2. **Post-analysis guard** (`lib/ai/analyser.ts`) — server-side filter after Mistral returns programs; supplements with rule-based picks if fewer than 3 eligible programs found.

Eligibility rules (`ELIGIBLE_CATEGORIES` in `quick-recommend.ts`):
- BAC → preparatoire, licence, architecture
- Licence 1/2 → licence only
- Licence 3 → licence, ingenierie, master
- Master → master only

### OCR Pipeline
Two-engine system with canvas preprocessing first:

```
File (PDF/image)
  → pdfjs-dist render (local worker at /pdf.worker.min.mjs, JBIG2 WASM at /wasm/jbig2.wasm)
  → preprocessTranscriptForVL() [grayscale, 8% crop, NO threshold] → minicpm-v
  → preprocessTranscript() [grayscale, Otsu threshold, 8% crop] → Tesseract fallback
```

For CIN: `preprocessCIN()` [3% crop, Otsu] → Tesseract → `documentParser.ts` with Tunisian governorate lookup for city.

Orphan grades (minicpm-v can't read subject name → returns `"row_N"` placeholder): mapped positionally using the diploma type's `fieldOrder` array.

### Email
`lib/email.ts` wraps nodemailer. Transport is lazy-initialized and cached. Dev mode: Ethereal fake SMTP, preview URL logged. Prod: configure 4 env vars. Email send is always `void` — never blocks the API response.

### Diploma Structure
`DIPLOMA_TYPES` in `lib/diploma-types.ts` defines all 6 BAC series + Licence/Master/BTS/Doctorat with their grade field keys. The key `moyenneGenerale` is standard for all types.

In `dossier/new`: `buildRequiredDiplomes(niveau)` auto-populates the required diploma entries when the student selects their study level. Entries are "locked" (no type selector, no remove button) when `niveauEtude !== "AUTRE"`.

### Analyser (Mistral)
`lib/ai/analyser.ts`:
- Accepts `locale` parameter → injects language instruction into system prompt
- Merges grades from `diplomes[].champs` + `dossier.notes` (both)
- Strips unknown grade keys (e.g. Arabic `إعلامية`) before sending to Mistral
- Hard eligibility guard post-Mistral using `isEligibleFiliere()`
- If Mistral returns <3 eligible programs → supplements with `ruleBasedScore()` filtered to eligible only
- Justification format: 2-3 sentences of human-like prose, no scores/numbers, in the student's language

### Real-time Recommendations
`lib/quick-recommend.ts` exports:
- `isEligibleFiliere(categorie, nom, niveau)` — used by both frontend (step 4 filter) and API
- `ELIGIBLE_CATEGORIES` — record of niveau → allowed categories
- `isEligible(nom, niveau)` — internal keyword fallback

The engine debounces 700ms on grade/niveau changes. For BAC students, recs are hidden until `sousType` (série) is chosen.

### RTL Layout
All three layouts (student, admin, supervisor) set `dir={dir}` from `useI18n()` on the outer wrapper. CSS logical properties are used throughout:
- `borderRight` / `borderLeft` → `borderInlineEnd` / `borderInlineStart`
- `paddingLeft` → `paddingInlineStart`
- `marginLeft` / `marginRight` → `marginInlineStart` / `marginInlineEnd`
- `translateX(-100%)` (close → slide off-screen) must be conditioned on `dir === "rtl"` → `translateX(100%)` since CSS transforms are always physical.
- Sidebar anchor: `[dir === "rtl" ? "right" : "left"]: 0` as computed property key.
- ChatWidget: fixed at `[dir === "rtl" ? "left" : "right"]: "24px"`.

### Dashboard Analytics
Both admin and supervisor dashboards share the same `Performance & Targets` section computed entirely client-side from the `stats` API response. No extra API calls. Key computed values:
- `achieved` — filières where `estComplete === true`
- `acceptance` — `VALIDE / (VALIDE + REJETE) * 100`
- `pending` — `SOUMIS + EN_ANALYSE`
- `filStatus(taux, estComplete)` — returns `{ label, color, bg, icon, rank }` used for both the per-filière list and sorting
- The per-filière list is sorted ascending by `rank` (best → worst) so critical programs surface first.

---

## Conventions

### Styling
All styles are inline `React.CSSProperties`. No CSS modules, no Tailwind, no styled-components. Targeted `<style>` blocks for animations (`@keyframes`) and pseudo-classes (`:focus`, `::placeholder`, `:hover`).

Color palette:
- Navy: `#060d1f` / `#070e20`
- Gold: `#f5c842` / `#e8a820`
- Light text: `#f8fafc` / `#f1f5f9`
- Muted: `#64748b`, `#475569`, `#334155`
- Green (success): `#4ade80`
- Red (error): `#f87171`
- Blue (info): `#60a5fa`
- Purple (waitlist / notes): `#a78bfa`

### i18n
All user-facing strings go through `t("key.path")`. The `t()` function supports `{var}` interpolation. Never hardcode French/English/Arabic text in JSX — even error messages use dictionary keys. Three files: `dictionaries/fr.ts` (default), `en.ts`, `ar.ts`. Arabic uses RTL via `document.documentElement.dir = "rtl"`.

Exception: short locale-dependent strings inside pure computation blocks (not JSX) use the `loc(fr, en, ar)` inline helper pattern — e.g. dashboard analytics labels where adding full i18n keys would be disproportionate.

### API Patterns
- Always return the same error shape: `{ error: string }`
- Rate limiting: import `checkRateLimit` and `getClientIp` from `lib/rate-limit.ts`
- Auth check: `const session = await getSession()` — returns `null` if unauthenticated
- Never throw from email send (always `void` + try/catch)
- Analysis is always fired with `fetch(...).catch(() => {})` (non-blocking fire-and-forget)

### State management
React `useState` only — no Redux, no Zustand. For shared auth state: `useAuth()` from `lib/auth-context.tsx`. For i18n: `useI18n()`. The Prisma singleton uses `globalThis` for caching.

### File uploads
All documents go to `public/uploads/{dossierId}/` (local filesystem). Production deployment should replace `writeFile` in `documents/route.ts` with S3/Cloudinary. Files are served at `/uploads/{dossierId}/{filename}`.

---

## Key File Map

| What you want | Where it is |
|---|---|
| Dossier creation flow | `app/(student)/student/dossier/new/page.tsx` |
| Dossier edit flow | `app/(student)/student/dossier/[id]/edit/page.tsx` |
| Diploma field definitions | `lib/diploma-types.ts` |
| Grade key aliases | `lib/ocr/vl-ocr.ts` → `GRADE_KEY_ALIASES` |
| Eligibility rules | `lib/quick-recommend.ts` → `ELIGIBLE_CATEGORIES` |
| Image preprocessing | `lib/ocr/preprocess.ts` |
| CIN city extraction | `lib/ocr/documentParser.ts` → `parseCIN()` |
| Mistral analysis prompt | `lib/ai/analyser.ts` → `systemPrompt` + `userPrompt` |
| Email templates | `lib/email.ts` |
| Status change side-effects | `app/api/dossiers/[id]/statut/route.ts` |
| Auth middleware | `middleware.ts` |
| Rate limiter | `lib/rate-limit.ts` |
| PDF generation | `lib/generatePDF.ts` |
| Chatbot backend | `app/api/chat/route.ts` |
| Active year resolution | `lib/annee.ts` → `getActiveAnnee()` |
| Per-year capacity | `app/api/filieres/[id]/capacite/route.ts` |
| Year CRUD (admin) | `app/api/admin/annees/route.ts` + `[id]/route.ts` |
| Year list (all roles) | `app/api/annees/route.ts` |
| Dashboard KPI aggregates | `app/api/admin/stats/route.ts` (accepts `?anneeId`) |
| Admin year management UI | `app/(admin)/admin/annees/page.tsx` |
| Supervisor analytics | `app/(supervisor)/supervisor/dashboard/page.tsx` |
| DonutChart component | `components/charts/DonutChart.tsx` |
| BarChart component | `components/charts/BarChart.tsx` |

---

## Environment Variables (all of them)

```env
# Required
DATABASE_URL="postgresql://postgres:password@localhost:5432/preenrollment"
JWT_SECRET="64-char-hex"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"

# AI (required for analysis, chatbot, OCR)
OLLAMA_URL="http://localhost:11434"
OLLAMA_MODEL="mistral"          # analyser + chatbot
OLLAMA_VL_MODEL="minicpm-v"     # transcript OCR vision model

# Email (optional — leave blank for Ethereal dev preview)
SMTP_HOST=""
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER=""
SMTP_PASS=""
EMAIL_FROM="IIT Pré-Inscription <noreply@iit.edu.tn>"

# Cron (required if using the automated reminder endpoint)
CRON_SECRET=""
```

---

## Things NOT To Do

- **Don't add `await` before `params`** — it already returns a promise in Next.js 16, always `const { id } = await params`.
- **Don't use `pages/` directory** — App Router only.
- **Don't skip `prisma generate` after schema changes** — and restart the dev server after.
- **Don't send Arabic text to jsPDF** — always `sanitize()` first.
- **Don't add `await` before `sendStatusEmail()`** — it must be `void` to stay non-blocking.
- **Don't add analysis logic to `statut/route.ts`** — it was removed intentionally to prevent duplicate analysis + notifications. The client fires it separately before the status PATCH.
- **Don't use `prisma.utilisateur.findUnique()` without selecting `avatarUrl`** — the login route used to miss it, causing avatar delay.
- **Don't use raw grade key strings** — always go through `GRADE_LABELS` in `generatePDF.ts` or `GRADE_KEY_ALIASES` in `vl-ocr.ts`.
- **Don't forget `npx prisma generate` after `prisma db push`** — yes, both are required.
- **Don't put `capacite` directly on `Filiere`** — the schema stores it per-year in `FiliereCapacite`. Always resolve the active year first via `getActiveAnnee()`, then join `capacites: { where: { anneeId: annee.id } }`.
- **Don't use `URL.createObjectURL(pdfFile)` as an `<img>` src** — images cannot render PDF blob URLs. Use the `imageBase64` (PNG data URL rendered by pdfjs) for preview.
- **Don't use physical CSS properties (`borderRight`, `paddingLeft`) in layouts** — use logical properties (`borderInlineEnd`, `paddingInlineStart`) so RTL works automatically. Exception: `translateX` is always physical and must be conditioned on `dir`.

---

## Ollama Model Requirements

| Model | Purpose | Pull command |
|---|---|---|
| `mistral` | Dossier analysis + AI chatbot | `ollama pull mistral` |
| `minicpm-v` | Transcript grade OCR | `ollama pull minicpm-v` |

The vision OCR (`/api/ocr/document`) auto-detects installed models — it searches for any model matching `minicpm.v` or `qwen.*vl` patterns. If none found, it returns `{ fallback: true }` and the client uses Tesseract.

---

## Deployment Checklist

1. Set all env vars (especially `SMTP_*`, `CRON_SECRET`, and `NEXT_PUBLIC_APP_URL`)
2. Replace `public/uploads/` filesystem with S3/Cloudinary in `app/api/dossiers/[id]/documents/route.ts`
3. Replace in-memory rate limiter (`lib/rate-limit.ts` `Map`) with Redis for multi-instance deployments
4. Run `npx prisma migrate deploy` (not `db push`) in production
5. Ensure Ollama is accessible at `OLLAMA_URL` with both models pulled
6. Create the first academic year at `/admin/annees` and set it active
7. Set enrollment period at `/admin/parametres` before going live
8. Set per-filière capacity targets for the active year via `/admin/filieres`

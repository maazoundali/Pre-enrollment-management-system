# IIT — Portail de Pré-Inscription Universitaire

> **Institut International de Technologie** — Université Nord Américaine Privée

A full-stack university pre-enrollment management system built with **Next.js 16**, **PostgreSQL**, and **Prisma 7**. Students apply online, upload documents scanned with OCR, receive AI-powered program recommendations, and are guided by a built-in AI chatbot. Administrators review and batch-process applications, verify documents, manage academic years and per-year enrollment targets, message students, and trigger deadline reminders. Supervisors browse individual dossiers, leave internal notes, and monitor performance against enrollment targets on a rich analytics dashboard. Transactional emails notify students of every meaningful event.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM | Prisma 7 (`@prisma/adapter-pg`) |
| Auth | JWT (`jose`) + httpOnly cookies (7-day expiry) |
| OCR | Tesseract.js (client-side) + minicpm-v vision LLM via Ollama (primary) |
| Image preprocessing | Canvas API — Otsu's threshold, contrast boost, border crop (`lib/ocr/preprocess.ts`) |
| AI — Dossier Analysis | Ollama / Mistral (local LLM, `lib/ai/analyser.ts`) |
| AI — Recommendations | Rule-based scoring engine with per-program threshold bands (`lib/quick-recommend.ts`) |
| AI — Chatbot | Ollama / Mistral streaming (`app/api/chat/route.ts`) |
| Email | Nodemailer — configurable SMTP; Ethereal fake-SMTP on localhost |
| PDF Export | jsPDF (dynamic import — zero bundle impact) |
| i18n | Custom React Context (FR / EN / AR with RTL support) |
| Styling | Inline `React.CSSProperties` + targeted CSS media queries |

---

## Features

### Student Space (`/student`)

#### Account & Profile
- **Registration** — email, password, name, gender, GDPR consent with custom gold-gradient toggle and full terms modal.
- **Forgot password** — secure token-based reset flow. Student clicks "Mot de passe oublié ?", receives a reset link by email (1-hour expiry, one-time use), sets a new password. Email pre-filled from the login form.
- **Profile completion** — scan CIN/passport PDF with OCR to auto-fill date of birth, ID number, address. Supports Tunisian CIN (Arabic/French bilingual) and international passports (MRZ).
- **Photo avatar** — uploads to the `PHOTO` document slot; sidebar avatar switches from initials to the photo immediately on login.

#### Dossier Flow
- **4-step dossier** — Documents → Academic background (diplomas + grades) → Program selection → Review & submit.
- **Duplicate prevention** — a student can only have one active dossier at a time. `POST /api/dossiers` returns 409 if a non-REJETE dossier already exists; the `/dossier/new` page redirects to the existing dossier on mount.
- **Level-driven diploma list** — selecting a study level auto-populates the exact required diploma entries (e.g. Licence 2 → BAC + Relevé L1). Entries show a gold "Requis" badge and cannot be removed or retyped.
- **OCR grade extraction** — two-engine pipeline: minicpm-v vision LLM (primary, understands RTL table structure and Arabic) + Tesseract fallback. Canvas preprocessing (Otsu's threshold, crop, contrast) runs before any engine. Detected grades highlighted in gold; student corrects if needed.
- **Document preview** — eye icon next to any attached file opens it in a new tab before submission.
- **Document verification status** — students see the admin's verdict (Vérifié / Refusé / Qualité insuffisante) and any admin note directly on their document list.
- **Waitlist** — if the chosen program is at capacity (counted by VALIDE dossiers for the active academic year), the dossier is transparently redirected to LISTE_ATTENTE with an auto-assigned rank at submission time.
- **Status tracking** — 4-step progress bar (Brouillon → Soumis → En analyse → Validé / Rejeté / Liste d'attente).
- **Application timeline** — dated mini-timeline below the progress bar showing when the dossier was created and when each status was reached, with color-coded dots.
- **Edit & resubmit** — mirrors the dossier creation flow; pre-populates all saved data; shows contextual title ("Corriger mon dossier" vs "Reprendre ma pré-inscription").
- **Dossier PDF export** — branded A4 PDF with IIT logo, all grades mapped to readable labels, Arabic text sanitized for jsPDF compatibility.
- **Acceptance letter PDF** — when status is VALIDE, a green "Lettre d'acceptation" button appears. Generates a formal official letter: IIT letterhead, navy/gold design, student address block, programme box, closing date and fees, signature block. Suitable for printing and administrative use.

#### Real-time Program Recommendations
- Sidebar panel shows live ranked recommendations as the student fills grades (debounced 700 ms).
- **11 program profiles** — keyword weights, key subjects, grade threshold bands, BAC series matrix, study-level eligibility matrix.
- **Hard eligibility filter** — BAC students never see engineering cycles; Licence 1/2 students never see Master programs. Ineligible programs shown in a collapsed "non accessible" section with an explanation.
- For BAC students, recommendations are hidden until a specialization (série) is chosen.
- Each card is expandable showing strengths and weaknesses with numeric grade citations.

#### Discovery
- **Program browser** — expandable cards grouped by cycle, all collapsed by default. Each card has an "En savoir plus" external link to the IIT website (URL mapped per category: Préparatoire / Ingénierie / Licence / Master / Architecture) and a separate "Postuler →" button.
- **Program comparison** — select any 2 programs and compare side-by-side in a modal.
- **Notifications** — bell dropdown, mark-as-read, unread badge, polled every 60 s.
- **Enrollment banner** — dynamic countdown to deadline, "not yet open", or "closed" state.

---

### Admin Space (`/admin`)

#### Academic Year Management
- Create, activate, and archive academic years (`/admin/annees`).
- Only one year can be **active** at a time. The active year determines which dossiers count against capacity and which stats the dashboard shows by default.
- Archived years are read-only and hidden from the active selector.
- **Per-year enrollment targets** — each filière has a separate `capacite` (hard cap) and optional `objectif` (soft planning target) per academic year via the `FiliereCapacite` table.

#### Dossier Review
- **Full profile view** — identity (with photo), all diplomas, grades with proper French labels, course type, source.
- **Admin dossier editing** — full-screen modal to edit any field (student identity, diplomas, grades, filière, document upload) regardless of status; student is notified via `DOSSIER_MAJ` notification; all changes logged to the audit trail.
- **Stale analysis prompt** — when the admin saves grade changes in the edit modal, a gold warning banner appears with a "Relancer l'analyse" button if grades actually changed, so the AI score stays current.
- **Document verification** — inline panel per document: mark as **Vérifié** / **Refusé** / **Qualité insuffisante**, add an optional note, optionally notify the student (in-app notification + email). Verification state shown with color badge; admin can revise at any time.
- **Message to student** — free-text compose box in the action sidebar; sends an in-app `DOSSIER_MAJ` notification and a dedicated email in one click. No status change required.
- **Internal notes** — private admin/supervisor notes (Ctrl+Enter), timestamped and author-attributed. Displayed prominently above the audit log with a purple highlight border.
- **Inline document preview** — PDF iframe and image modal without leaving the page.
- **AI analysis** — Mistral-powered analysis with human-like justification in the student's language; language passed at submission time. Re-runnable on demand.
- **Audit log** — immutable collapsible timeline of every action (status change, analysis run, note added, document uploaded, admin edit, document verified, message sent).
- **Workflow decisions** — transitions with confirmation modals; rejection requires a reason included in the email notification; **VALIDE → Révoquer** returns the dossier to BROUILLON and triggers automatic waitlist promotion.
- **PDF export** — full dossier as branded PDF.

#### Automatic Waitlist Promotion
When a VALIDE dossier is moved to BROUILLON or REJETE (freeing a spot), the system automatically finds the top-ranked waitlisted dossier for the same filière and year, promotes it to EN_ANALYSE, sends an in-app notification, and fires a status email. No admin action required.

#### Batch Operations
- Checkbox multi-select with "Select all", bulk status transitions, reports `N updated, M skipped`.

#### Program Management
- Create, edit, delete programs with all metadata including explicit **Catégorie** (Préparatoire / Ingénierie / Licence / Master / Architecture) — used for grouping and eligibility filtering. Falls back to keyword detection for programs without a category.

#### Advanced Dossier Filtering
The dossier list supports both status tab filtering and a collapsible **Filtres avancés** panel:

| Filter | Values |
|---|---|
| Filière | Dropdown of all programs |
| Série BAC | SCIENTIFIQUE / MATHS_INFO / TECHNIQUE / ECONOMIE / LETTRES / SPORT |
| Score IA | Min and/or max (0–100) |
| Date de soumission | From / To date range |

Active filter count shown on the button; one-click reset. All filters combine and apply client-side on the already-loaded dataset.

#### Dashboard & Analytics
- **KPI cards** — students, dossiers, validation rate, average AI score. Each card has a colored top-border accent, icon pill, and entrance animation.
- **Status donut chart** — interactive hover: highlights the hovered slice, dims others, shows count + percentage in the center. Legend syncs on hover. Gaps between slices for clarity.
- **Capacity bar chart** — gradient-filled bars with glow, percentage badge, hover highlight. Color shifts green → amber (>60%) → red (>80%).
- **Capacity summary banner** — total enrolled vs. total capacity as large numbers with a full-width animated progress bar, color-coded by fill level and a contextual status label.
- **Performance & Targets section** — four insight cards (targets hit, acceptance rate, pipeline backlog, waitlist count) plus a per-filière status list sorted by achievement (✓ Objectif atteint / ↗ En bonne voie / → Modéré / ! Critique).
- **Recent activity feed** — last 5 non-draft dossiers with initials avatar, relative timestamps, and status badge.
- **Year selector** — filter all dashboard data by academic year.
- **CSV export** exports the currently filtered dossier list (name, email, status, program, score, dates).

#### Settings (`/admin/parametres`)
- **Enrollment period** — set open/close dates or master toggle. Blocks `POST /api/dossiers` outside the window.
- **Deadline reminders** — send a reminder email + in-app notification to every student whose dossier is still in BROUILLON:
  - **Auto mode** (cron): `POST /api/admin/send-reminders` with `Authorization: Bearer <CRON_SECRET>` — only fires if closing date is within 48 hours.
  - **Manual mode** (UI): "Envoyer (si dans les 48 h)" respects the same window; "Forcer l'envoi" bypasses it with a confirmation prompt.

---

### Supervisor Space (`/supervisor`)

- **Dashboard** — rich analytics view with year selector:
  - KPI cards (students, dossiers, validation rate, average score) with animated entrance and color accents.
  - Status donut chart and capacity bar chart (same interactive components as admin).
  - **Capacity summary banner** — total enrolled vs. target across all filières with a large progress bar.
  - **Performance & Targets section** — insight cards (targets hit, acceptance rate, pipeline, waitlist) and a per-filière achievement list sorted by status.
  - **Recent activity feed** — last 5 non-draft dossiers with initials avatar and relative timestamps.

- **Dossier list** (`/supervisor/dossiers`) — full list with status tabs, text search, advanced filters (filière, BAC series, score range), and **academic year selector**.

- **Dossier detail** (`/supervisor/dossiers/:id`) — read-only view of identity, diplomas, grades, AI analysis, document list, and **internal notes** (supervisors can read and add notes; clearly labelled "Vue superviseur — lecture seule").

- **Reports** — generate over custom date ranges, export as CSV or JSON.

---

### Email Notifications

Transactional emails sent on every meaningful event:

| Trigger | Subject |
|---|---|
| Dossier soumis | ✅ Votre pré-inscription a bien été reçue |
| En analyse | 🔍 Votre dossier est en cours d'analyse |
| Validé | 🎉 Félicitations — Votre pré-inscription a été acceptée ! |
| Rejeté | ❌ Décision concernant votre pré-inscription (includes rejection reason) |
| Liste d'attente | ⏳ Vous êtes sur liste d'attente |
| Promu depuis liste d'attente | 🎉 Une place s'est libérée — dossier en cours d'analyse |
| Document vérifié / refusé / qualité insuffisante | ✓ / ✗ / ⚠ with admin note |
| Message de l'administration | 📩 Message de l'administration — IIT Pré-inscription |
| Rappel de clôture | ⏰ Rappel — Clôture des inscriptions dans 48 h |
| Mot de passe oublié | 🔑 Réinitialisation de votre mot de passe |

- **On localhost** — no config needed; emails captured by Ethereal (preview URL logged to console).
- **In production** — set 4 env vars (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`). No code change.
- Sending is non-blocking — email failure never affects the API response.

---

### AI Chatbot

Floating widget (bottom-right, moves to bottom-left in RTL/Arabic), Ollama / Mistral powered:

**Guest mode** — FAQ-oriented, 4 quick-question chips, login nudge, cannot access personal data.

**Authenticated mode** — dossier context loaded silently on first open; personalized guidance, streaming token-by-token, responds in the student's language.

---

### Cross-cutting Features

#### Internationalization (FR / EN / AR)
- Full three-language support on every page, component, and error message.
- Arabic switches to RTL layout using CSS logical properties (`borderInlineEnd`, `paddingInlineStart`, etc.) and conditional `dir`-based transforms — no separate RTL stylesheet.
- Language persisted in `localStorage`. All hardcoded strings use `t()` — no French text leaks in EN/AR modes.

#### Mobile Responsiveness
- Sidebar collapses into a slide-over drawer on screens ≤768px. IIT logo in mobile top bar.
- Step 3 of the dossier creation form (academic background + recommendations sidebar) collapses from a 2-column grid to a single column on mobile.
- Student dossier detail two-column grid also collapses on mobile.

#### Accessibility
- `ConfirmModal` has `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby` on the message, and `aria-label` on buttons.
- Focus is moved to the Cancel button when a modal opens.
- Escape key closes all modals.

#### Session Timeout Warning
- Modal with live countdown 5 minutes before JWT expiry. "Stay signed in" refreshes silently.

#### Terms & Conditions / GDPR
- Consent toggle on registration (custom gold-gradient styled, not a native checkbox), full 5-section T&C modal.

#### IIT Branding
- Official IIT logo across all sidebars, mobile bars, landing page hero, auth pages, loading modal, PDF export, acceptance letter, and browser tab favicon.

---

## Project Structure

```
preenrollment/
├── app/
│   ├── (auth)/                    # Login, Register, Forgot password, Reset password
│   ├── (student)/                 # Student layout + pages
│   │   └── student/
│   │       ├── dashboard/
│   │       ├── dossier/[id]/      # Detail + timeline + verification status + acceptance letter
│   │       ├── dossier/[id]/edit/ # Edit draft / correct rejected dossier
│   │       ├── dossier/new/       # 4-step dossier form + real-time recommendations
│   │       ├── filieres/          # Program browser (learn more + postuler) + comparison
│   │       ├── notifications/
│   │       └── profile/complete/  # OCR profile completion
│   ├── (admin)/                   # Admin layout + pages
│   │   └── admin/
│   │       ├── annees/            # Academic year CRUD + target/capacity management
│   │       ├── dashboard/         # KPI + charts + performance analytics + year filter
│   │       ├── dossiers/          # List + advanced filters + CSV + batch + detail/review
│   │       ├── filieres/          # Program management (with category)
│   │       └── parametres/        # Enrollment period + deadline reminders
│   ├── (supervisor)/
│   │   └── supervisor/
│   │       ├── dashboard/         # KPI + charts + performance analytics + year filter
│   │       ├── dossiers/          # Dossier list with filters + year filter (read-only)
│   │       ├── dossiers/[id]/     # Dossier detail + internal notes (read-only)
│   │       └── rapports/
│   ├── api/
│   │   ├── annees/                # GET — shared read-only year list (all authenticated roles)
│   │   ├── auth/                  # register, login, logout, me, forgot-password, reset-password
│   │   ├── chat/                  # Streaming Mistral chatbot (guest + auth)
│   │   ├── dossiers/              # CRUD + statut + documents + analyse + batch
│   │   │   └── [id]/documents/[docId]/verify/  # Admin document verification
│   │   ├── admin/
│   │   │   ├── annees/            # Academic year CRUD (admin only)
│   │   │   │   └── [id]/          # Activate / archive individual year
│   │   │   ├── message/           # Admin → student free-text message
│   │   │   ├── send-reminders/    # Deadline reminder batch (cron or manual)
│   │   │   └── stats/             # KPI aggregates — accepts ?anneeId for year filtering
│   │   ├── filieres/
│   │   │   └── [id]/capacite/     # GET / PUT per-year filière capacity
│   │   ├── notifications/
│   │   ├── ocr/document/          # Vision LLM OCR (minicpm-v via Ollama)
│   │   ├── parametres/
│   │   ├── rapports/
│   │   └── recommend-preview/     # Real-time recommendations
│   ├── page.tsx                   # Public landing page + chatbot
│   └── layout.tsx                 # Providers + ChatWidget + SessionWarningModal
├── components/
│   ├── charts/DonutChart.tsx      # Interactive hover: slice highlight, % in center, legend sync
│   ├── charts/BarChart.tsx        # Gradient bars with glow + % badge + hover
│   ├── ChatWidget.tsx             # RTL-aware (left anchor in Arabic)
│   ├── CompareModal.tsx
│   ├── ConfirmModal.tsx           # ARIA-compliant modal with focus trap + Escape key
│   ├── DocumentPreviewModal.tsx
│   ├── EnrollmentBanner.tsx
│   ├── FilePreview.tsx            # Thumbnail for images; red badge for PDFs
│   ├── IITLoadingModal.tsx
│   ├── LanguageSwitcher.tsx
│   ├── RouteLoadingBar.tsx
│   ├── SessionWarningModal.tsx
│   ├── Skeleton.tsx
│   └── TermsModal.tsx
├── dictionaries/
│   ├── fr.ts / en.ts / ar.ts     # Full i18n coverage for all pages and components
├── lib/
│   ├── ai/analyser.ts             # Mistral analysis (locale-aware, eligibility guard)
│   ├── annee.ts                   # getActiveAnnee() helper used by stats + waitlist
│   ├── audit.ts                   # Immutable audit log (STATUT_CHANGE, DOCUMENT_VERIFIED, …)
│   ├── auth-context.tsx
│   ├── auth.ts
│   ├── diploma-types.ts           # BAC series field definitions (SCIENTIFIQUE, MATHS_INFO, …)
│   ├── email.ts                   # Nodemailer service — all email templates
│   ├── enrollment.ts
│   ├── generateAcceptanceLetter.ts # Official acceptance letter PDF (VALIDE dossiers only)
│   ├── generatePDF.ts             # jsPDF dossier export (grade labels, Arabic sanitization)
│   ├── i18n-context.tsx
│   ├── notifications.ts
│   ├── ocr/
│   │   ├── documentParser.ts      # CIN/passport field extraction + Tunisian city lookup
│   │   ├── preprocess.ts          # Canvas preprocessing (Otsu, crop, contrast)
│   │   └── vl-ocr.ts              # minicpm-v / Qwen2.5-VL OCR engine
│   ├── prisma.ts
│   ├── quick-recommend.ts         # Real-time engine + eligibility rules
│   ├── rate-limit.ts
│   ├── use-mobile.ts
│   └── workflow.ts                # State machine + role permissions
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts                    # Admin + supervisor accounts + all filières
│   ├── seed-dossiers.ts           # Test students + dossiers (all statuses, docs, waitlist)
│   └── seed-waitlist.ts           # Dedicated waitlist scenario seed
├── public/
│   ├── logo.png
│   ├── pdf.worker.min.mjs         # Local pdfjs worker (enables JBIG2 decoding)
│   └── wasm/
│       ├── jbig2.wasm             # JBIG2 decoder for scanned PDFs
│       └── openjpeg.wasm
├── prisma.config.ts
└── middleware.ts
```

---

## Database Schema

### Models

| Model | Description |
|---|---|
| `Utilisateur` | All users. Includes `consentementRGPD`, `avatarUrl`. |
| `PasswordReset` | Password reset tokens — 1-hour expiry, one-time use. |
| `AnneeAcademique` | Academic year with `active` flag, optional open/close dates. Only one can be active. |
| `Filiere` | Programs with curriculum, fees, language, duration, `categorie`. No direct capacity field — capacity lives in `FiliereCapacite`. |
| `FiliereCapacite` | Per-filière, per-year enrollment quota. `capacite` = hard cap (max VALIDE dossiers). `objectif` = soft planning target (optional). Unique on `(filiereId, anneeId)`. |
| `Dossier` | Student dossier tied to an `AnneeAcademique`. Includes waitlist position and `notes` (grade mirror). |
| `Diplome` | Diplomas per dossier — title, year, type, series, institution, `champs` (JSON grades). |
| `Document` | Uploaded files. Has `verification`, `verificationNote`, `verifiedAt`, `verifiedBy` fields. |
| `Analyse` | AI scoring result with program recommendations. |
| `NoteInterne` | Private note — writable by admins and supervisors. |
| `AuditLog` | Immutable action record (who, what, when, JSON details). |
| `Notification` | In-app notifications (5 types). |
| `Rapport` | Generated statistics report (supervisor). |
| `ParametreSysteme` | Key/value store: `inscription_active`, `inscription_debut`, `inscription_fin`. |

### Key Enums

```
Role             ETUDIANT | ADMINISTRATEUR | SUPERVISEUR
Statut           BROUILLON → SOUMIS → EN_ANALYSE → VALIDE | REJETE
                 LISTE_ATTENTE (auto-assigned on submission when program is full)
TypeIdentite     CIN | PASSEPORT
NiveauEtude      BACCALAUREAT | LICENCE_1..3 | MASTER_1..2 | DOCTORAT | AUTRE
TypeCours        COURS_JOUR | COURS_SOIR | FORMATION_CONTINUE
TypeDoc          CNI | PASSEPORT | DIPLOME | RELEVE_NOTES | PHOTO | AUTRE
TypeNotif        DOSSIER_INCOMPLET | RECOMMANDATION | DECISION_ADMIN | STATUT_MAJ | DOSSIER_MAJ
VerificationDoc  VERIFIED | REJECTED | NEEDS_REUPLOAD
```

### Workflow

```
BROUILLON ──► SOUMIS* ──► EN_ANALYSE ──► VALIDE ──► BROUILLON (admin revoke → frees spot)
                │               │              └──► REJETE
                │               └──────────────────► REJETE ──► SOUMIS (resubmit)
                └──────────────────────────────────► REJETE

LISTE_ATTENTE ──► EN_ANALYSE (auto on spot-freed, or manual admin promote)
              ──► SOUMIS | BROUILLON (student withdraws)
```

*At submission, if the filière has reached its `capacite` for the active year (VALIDE count ≥ capacite), the dossier is transparently redirected to LISTE_ATTENTE with an auto-assigned rank.

---

## Environment Variables

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/preenrollment"
JWT_SECRET="your-32-byte-hex-secret"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"

# Ollama (local LLM — required for AI analysis, chatbot, and OCR)
OLLAMA_URL="http://localhost:11434"
OLLAMA_MODEL="mistral"
OLLAMA_VL_MODEL="minicpm-v"        # Vision model for transcript OCR

# Email (SMTP) — leave blank for localhost (Ethereal preview in console)
SMTP_HOST=""                        # e.g. smtp.university.tn
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER=""
SMTP_PASS=""
EMAIL_FROM="IIT Pré-Inscription <noreply@iit.edu.tn>"

# Cron secret — protects POST /api/admin/send-reminders from unauthenticated callers
# Set to any strong random string; pass as Authorization: Bearer <value>
CRON_SECRET=""
```

Generate a JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL
- [Ollama](https://ollama.com) with required models:
  ```bash
  ollama pull mistral       # AI analysis + chatbot
  ollama pull minicpm-v     # Vision OCR for transcripts
  ```

### Installation

```bash
# 1. Clone and install
git clone <repo-url>
cd preenrollment
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET

# 3. Create the database
createdb preenrollment

# 4. Push schema and generate Prisma client
npx prisma db push
npx prisma generate

# 5. Seed admin accounts and filières
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts

# 6. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Important:** After any `prisma db push` or schema change, always run `npx prisma generate` then **restart the dev server** to clear the module cache.

### First-time Setup

1. The seed creates `admin@portail.tn` and `superviseur@portail.tn` (password: `demo1234`).
2. Log in as admin, create an academic year at `/admin/annees`, and set it as active.
3. Configure the enrollment period at `/admin/parametres`.
4. Set per-filière capacity targets for the active year via `/admin/filieres`.
5. Optionally, seed test dossiers for all features:

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-dossiers.ts
```

This creates 12 test students (password: `demo1234`) covering every status and feature scenario. The script prints a full guide at the end.

### Manual admin promotion via psql (alternative to seed)

```sql
UPDATE utilisateurs SET role = 'ADMINISTRATEUR' WHERE email = 'admin@example.com';
UPDATE utilisateurs SET role = 'SUPERVISEUR'    WHERE email = 'supervisor@example.com';
```

### Email in Development

No SMTP configuration needed. When an email would be sent, the server logs:
```
[email] Preview (Ethereal): https://ethereal.email/message/...
```
Open the URL to inspect the rendered email.

### Email in Production

Set the SMTP variables in `.env` — no code change required:
```env
SMTP_HOST=smtp.university.tn
SMTP_PORT=587
SMTP_USER=noreply@university.tn
SMTP_PASS=yourpassword
EMAIL_FROM="IIT <noreply@university.tn>"
```

---

## API Reference

### Auth
| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/register` | Register with consent flag |
| POST | `/api/auth/login` | Login, sets JWT cookie, returns full user including `avatarUrl` |
| POST | `/api/auth/logout` | Clears cookie |
| GET | `/api/auth/me` | Current user + `sessionExpiresAt` |
| PATCH | `/api/auth/me` | Update profile |
| POST | `/api/auth/forgot-password` | Request password reset email (rate-limited, always returns 200) |
| POST | `/api/auth/reset-password` | Set new password using token |
| GET | `/api/auth/reset-password?token=` | Validate token before showing the form |

### Dossiers
| Method | Route | Description |
|---|---|---|
| GET | `/api/dossiers` | List (filter by statut, filiereId, anneeId, niveauEtude, typeCours, page, limit) |
| POST | `/api/dossiers` | Create draft — blocked outside enrollment period; returns 409 if active dossier exists |
| GET | `/api/dossiers/:id` | Full detail with documents, diplomas, and analyses |
| PUT | `/api/dossiers/:id` | Update fields + `diplomes` array + `notes` mirror + student identity (admin) |
| DELETE | `/api/dossiers/:id` | Delete draft |
| PATCH | `/api/dossiers/:id/statut` | Workflow transition; redirects to LISTE_ATTENTE on submission if filière is at capacity |
| POST | `/api/dossiers/:id/analyse` | Trigger Mistral AI analysis (accepts `{ locale }`) |
| POST | `/api/dossiers/:id/documents` | Upload document (PDF-only for CNI/Passport); admin may upload to any dossier |
| PATCH | `/api/dossiers/:id/documents/:docId/verify` | Set verification status (admin only); notifies student |
| GET | `/api/dossiers/:id/notes` | List internal notes |
| POST | `/api/dossiers/:id/notes` | Add internal note (admin or supervisor) |
| GET | `/api/dossiers/:id/audit` | Full audit log (admin/supervisor only) |
| PATCH | `/api/dossiers/batch` | Bulk status transition |

### Admin
| Method | Route | Description |
|---|---|---|
| GET | `/api/admin/annees` | List all academic years |
| POST | `/api/admin/annees` | Create a new academic year |
| PATCH | `/api/admin/annees/:id` | Update year (label, dates, activate, archive) |
| DELETE | `/api/admin/annees/:id` | Delete year (only if no dossiers linked) |
| POST | `/api/admin/message` | Send free-text message to a student (in-app notification + email) |
| POST | `/api/admin/send-reminders` | Send deadline reminder to all BROUILLON dossiers; accepts `{ force: bool }`; also accepts cron via `Authorization: Bearer <CRON_SECRET>` |
| GET | `/api/admin/stats` | KPI aggregates — accepts `?anneeId` to filter by year (defaults to active year) |

### Shared
| Method | Route | Description |
|---|---|---|
| GET | `/api/annees` | Read-only year list accessible to all authenticated roles |

### AI & OCR
| Method | Route | Description |
|---|---|---|
| POST | `/api/chat` | Streaming Mistral chatbot (guest FAQ or authenticated personalized) |
| POST | `/api/recommend-preview` | Real-time program recommendations — hard eligibility filter applied |
| POST | `/api/ocr/document` | Vision LLM OCR (minicpm-v via Ollama) for transcripts and CIN |

### Filières, Notifications, Settings & Reports
| Method | Route | Description |
|---|---|---|
| GET | `/api/filieres` | All programs (30 s cache) |
| POST | `/api/filieres` | Create (admin only) |
| PUT | `/api/filieres/:id` | Update (admin only) |
| DELETE | `/api/filieres/:id` | Delete (admin only) |
| GET | `/api/filieres/:id/capacite` | Get per-year capacity for a filière |
| PUT | `/api/filieres/:id/capacite` | Set per-year capacity (admin only) |
| GET | `/api/notifications` | List for current user |
| PATCH | `/api/notifications/:id/read` | Mark one read |
| POST | `/api/notifications/read-all` | Mark all read |
| GET | `/api/parametres` | System settings (60 s cache) |
| PATCH | `/api/parametres` | Update (admin only) |
| GET | `/api/rapports` | List reports (supervisor) |
| POST | `/api/rapports` | Generate report |
| DELETE | `/api/rapports/:id` | Delete report |

---

## OCR Pipeline

**For CIN/passport** (`profile/complete`):
1. PDF rendered via pdfjs-dist (with local worker + JBIG2 WASM at `/wasm/jbig2.wasm`)
2. `preprocessCIN()` — 3% edge crop, 2× upscale, Otsu's threshold
3. Tesseract (`ara+fra+eng`) → `documentParser.ts` extracts fields including city via Tunisian governorate lookup

**For transcripts** (`dossier/new`, `dossier/edit`):
1. PDF rendered via pdfjs-dist
2. `preprocessTranscriptForVL()` — 8% border crop, grayscale+contrast (no threshold) → sent to minicpm-v
3. `preprocessTranscript()` — same crop + Otsu threshold → Tesseract fallback
4. minicpm-v is given an explicit RTL column layout description and instructed to read each subject's grade from the correct column
5. When the student's BAC series is known, a targeted prompt lists only the relevant subjects
6. JSON response is sanitised before parsing: comma decimals (`08,00` → `8.0`) converted first, then invalid leading zeros removed
7. If minicpm-v returns nothing → Tesseract two-pass matching (same-line + ±2-line sliding window)

---

## Recommendation Engine

`lib/quick-recommend.ts` + `app/api/recommend-preview/route.ts`:

- Hard eligibility filter applied before scoring (BAC → only Prépa/Licences/Architecture; Licence 1/2 → Licences only)
- 11 program profiles with subject weights, threshold bands, BAC series matrix, niveau matrix
- Synergy detection, confidence tracking, trend analysis across multiple diplomas
- Results shown in sidebar during dossier creation with expandable strengths/weaknesses cards

---

## Security

### Rate Limiting
| Endpoint | Limit | Window |
|---|---|---|
| `POST /api/auth/login` | 10 | 15 min |
| `POST /api/auth/register` | 5 | 60 min |
| `POST /api/auth/forgot-password` | 5 | 15 min |
| `POST /api/auth/reset-password` | 10 | 15 min |

### File Upload Validation
Three defence layers on document uploads:
1. **Size** — max 10 MB.
2. **MIME type** — PDF, JPEG, PNG, WebP.
3. **Magic bytes** — first 12 bytes matched against known signatures.
4. **CNI/Passport** — PDF only (enforced server-side and via `accept=".pdf"` client-side).

### Password Reset Security
- Token = 32 random bytes (64-char hex) — brute-force proof
- 1-hour expiry; marked `usedAt` after use (single use)
- Old tokens deleted when a new request is made
- Forgot-password always returns 200 (no user enumeration)

### Cron Endpoint Security
`POST /api/admin/send-reminders` accepts either an authenticated admin session or an `Authorization: Bearer <CRON_SECRET>` header. Without either, it returns 403.

---

## Performance Notes

- jsPDF, Tesseract.js, and pdfjs-dist are all dynamic imports.
- Notifications polled every 60 s (not on every navigation).
- `EnrollmentBanner` caches its fetch at module level.
- Chatbot streaming uses `ReadableStream` piped from Ollama.
- Analysis fires non-blocking at submission — status change and notification are instant.
- Email sending is always non-blocking (`void` calls) — failure never affects the API response.
- `/reset-password` page validates token via `GET` before showing the form — no wasted renders.
- Advanced dossier filters (admin and supervisor) apply client-side on the pre-loaded dataset — no extra round trips.
- Acceptance letter PDF is generated entirely client-side via dynamic jsPDF import — no server round trip.
- `/api/admin/stats` accepts `?anneeId` — passes it through to all DB queries so the year selector on both dashboards filters everything server-side in one request.

---

## Seeding

### Base seed (required first)
Creates admin + supervisor accounts and all 11 filières:
```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
```

Credentials: `admin@portail.tn` / `superviseur@portail.tn` — password `demo1234`.

### Test dossiers seed (optional)
Creates 12 realistic students with dossiers in every status, documents in every verification state, and enrollment closing date set 47 h from now:
```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-dossiers.ts
```

Safe to re-run (uses upsert). Prints a full test guide on completion.

| Email | Statut | Purpose |
|---|---|---|
| `ahmed@test.tn` | SOUMIS | Normal review flow |
| `fatma@test.tn` | EN_ANALYSE | With AI score |
| `mohamed@test.tn` | VALIDE ★ | **Revoke to trigger waitlist promotion + test acceptance letter** |
| `nour@test.tn` | LISTE_ATTENTE #1 | **Auto-promoted when Mohamed is revoked** |
| `sarra@test.tn` | LISTE_ATTENTE #2 | Becomes #1 after Nour is promoted |
| `karim@test.tn` | REJETE | With rejection reason |
| `leila@test.tn` | EN_ANALYSE | **4 docs: VERIFIED / REJECTED / NEEDS_REUPLOAD / unreviewed** |
| `bilel@test.tn` | BROUILLON | **Deadline reminder target** |
| `amira@test.tn` | BROUILLON | **Deadline reminder target** |
| `rania@test.tn` | BROUILLON | **Deadline reminder target** |
| `yassine@test.tn` | BROUILLON | **Deadline reminder target** |
| `omar@test.tn` | SOUMIS | Génie Civil / BAC Technique |

All test accounts use password `demo1234`.

---

## One-time Migrations

### Backfill avatar URLs
```bash
npx tsx prisma/backfill-avatars.ts
```

---

## Resetting the Database

**Development only:**
```bash
npx prisma db push --force-reset
npx prisma generate
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
```
⚠️ Never use `--force-reset` in production.

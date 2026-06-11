// app/api/dossiers/[id]/documents/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { logAudit } from "@/lib/audit"
import { TypeDoc } from "@prisma/client"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"

type Params = { params: Promise<{ id: string }> }

const VALID_TYPES = new Set<TypeDoc>(["CNI", "DIPLOME", "RELEVE_NOTES", "PHOTO", "AUTRE"])

// ── File validation constants ──────────────────────────────────────────────────

const MAX_SIZE_MB = 10

/** Allowed MIME types by document category */
const ALLOWED_MIME: Record<string, true> = {
  "application/pdf": true,
  "image/jpeg":      true,
  "image/png":       true,
  "image/webp":      true,
}

/** Magic-byte signatures — defence in depth against renamed executables */
const MAGIC: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] },           // %PDF
  { mime: "image/jpeg",      bytes: [0xFF, 0xD8, 0xFF] },                  // JFIF/EXIF
  { mime: "image/png",       bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  { mime: "image/webp",      bytes: [0x52, 0x49, 0x46, 0x46] },            // RIFF (WebP)
]

function detectMime(buf: Uint8Array): string | null {
  for (const sig of MAGIC) {
    const offset = sig.offset ?? 0
    if (sig.bytes.every((b, i) => buf[offset + i] === b)) return sig.mime
  }
  return null
}

// ── GET /api/dossiers/:id/documents ───────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const dossier = await prisma.dossier.findUnique({ where: { id } })
  if (!dossier) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (session.role === "ETUDIANT" && dossier.etudiantId !== session.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const documents = await prisma.document.findMany({
    where: { dossierId: id },
    orderBy: { dateUpload: "desc" },
  })
  return NextResponse.json({ documents })
}

// ── POST /api/dossiers/:id/documents ──────────────────────────────────────────
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const isAdmin = session.role === "ADMINISTRATEUR"

  const { id } = await params
  const dossier = await prisma.dossier.findUnique({ where: { id } })
  if (!dossier) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!isAdmin) {
    // Students can only upload to their own dossier in BROUILLON or REJETE status
    if (session.role !== "ETUDIANT" || dossier.etudiantId !== session.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (dossier.statut !== "BROUILLON" && dossier.statut !== "REJETE") {
      return NextResponse.json(
        { error: "Documents can only be modified on a draft or rejected dossier." },
        { status: 422 }
      )
    }
  }
  // Admins can upload to any dossier regardless of status

  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const type = formData.get("type") as TypeDoc | null

    if (!file || !type) {
      return NextResponse.json({ error: "file and type are required" }, { status: 400 })
    }
    if (!VALID_TYPES.has(type)) {
      return NextResponse.json({ error: `Invalid document type: ${type}` }, { status: 400 })
    }

    // ── Size check ────────────────────────────────────────────────────────────
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        { error: `Fichier trop volumineux. Limite : ${MAX_SIZE_MB} Mo.` },
        { status: 413 }
      )
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "Le fichier est vide." }, { status: 400 })
    }

    // ── Read bytes for magic-byte check ───────────────────────────────────────
    const bytes  = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const head   = new Uint8Array(buffer.slice(0, 12))

    // ── MIME check (declared type) ────────────────────────────────────────────
    const declaredMime = file.type.split(";")[0].trim().toLowerCase()
    if (!ALLOWED_MIME[declaredMime]) {
      return NextResponse.json(
        { error: `Type de fichier non autorisé : ${declaredMime}. Formats acceptés : PDF, JPEG, PNG, WebP.` },
        { status: 415 }
      )
    }

    // ── Magic-bytes check (content vs. declared) ──────────────────────────────
    const detectedMime = detectMime(head)
    if (!detectedMime) {
      return NextResponse.json(
        { error: "Le contenu du fichier ne correspond pas à un format autorisé." },
        { status: 415 }
      )
    }
    // For PHOTO: only images allowed
    if (type === "PHOTO" && !detectedMime.startsWith("image/")) {
      return NextResponse.json(
        { error: "La photo d'identité doit être une image (JPEG, PNG ou WebP)." },
        { status: 415 }
      )
    }
    // For CNI / PASSEPORT: only PDF accepted (scanned document)
    if ((type === "CNI" || type === "PASSEPORT") && detectedMime !== "application/pdf") {
      return NextResponse.json(
        { error: "La pièce d'identité (CIN/Passeport) doit être au format PDF." },
        { status: 415 }
      )
    }

    // ── Write to filesystem ───────────────────────────────────────────────────
    // ⚠️  Replace with S3 / Cloudinary / Supabase Storage in production
    const dir = join(process.cwd(), "public", "uploads", id)
    await mkdir(dir, { recursive: true })

    const safeFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
    await writeFile(join(dir, safeFileName), buffer)

    const url = `/uploads/${id}/${safeFileName}`

    // Remove previous document of the same type (replace, don't accumulate)
    await prisma.document.deleteMany({ where: { dossierId: id, type } })

    const document = await prisma.document.create({
      data: { dossierId: id, type, nom: file.name, url },
    })

    // ── If PHOTO → update user avatar (for student upload only) ─────────────
    if (type === "PHOTO" && !isAdmin) {
      await prisma.utilisateur.update({
        where: { id: session.id },
        data:  { avatarUrl: url },
      })
    }
    // If admin uploads a PHOTO for a student, update the student's avatar
    if (type === "PHOTO" && isAdmin) {
      await prisma.utilisateur.update({
        where: { id: dossier.etudiantId },
        data:  { avatarUrl: url },
      })
    }

    // ── Audit log ─────────────────────────────────────────────────────────────
    await logAudit(session.id, id, "DOCUMENT_UPLOADED", {
      type,
      fileName: file.name,
      sizeMb: (file.size / (1024 * 1024)).toFixed(2),
      mime: detectedMime,
    })

    return NextResponse.json({ document }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/dossiers/:id/documents]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

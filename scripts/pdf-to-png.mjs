/**
 * Render first page of a PDF to PNG using pdfjs-dist + @napi-rs/canvas.
 * Usage: node scripts/pdf-to-png.mjs [path/to/file.pdf]
 *
 * If no argument given, auto-finds the first relevenotesbqc.pdf in public/uploads.
 */

import fs   from "fs"
import path from "path"
import { createCanvas, GlobalFonts } from "../node_modules/@napi-rs/canvas/index.js"

// pdfjs-dist: point workerSrc at the local worker file URL
import * as pdfjs from "../node_modules/pdfjs-dist/legacy/build/pdf.mjs"
const workerPath = new URL("../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).href
pdfjs.GlobalWorkerOptions.workerSrc = workerPath

// ── Find PDF ───────────────────────────────────────────────────────────────────
let pdfPath = process.argv[2]

if (!pdfPath) {
  const uploadsDir = "public/uploads"
  const find = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) { const r = find(full); if (r) return r }
      if (entry.isFile() && entry.name.toLowerCase().includes("relevenote")) return full
    }
    return null
  }
  pdfPath = find(uploadsDir)
  if (!pdfPath) {
    console.error("No relevenote*.pdf found in public/uploads. Pass a path as argument.")
    process.exit(1)
  }
}

const outPath = pdfPath.replace(/\.pdf$/i, ".png")
console.log(`Input  : ${pdfPath}`)
console.log(`Output : ${outPath}`)

// ── Load PDF ───────────────────────────────────────────────────────────────────
const pdfBytes = new Uint8Array(fs.readFileSync(pdfPath))
const loadTask = pdfjs.getDocument({ data: pdfBytes, disableFontFace: true, useWorkerFetch: false, isEvalSupported: false })
const pdf  = await loadTask.promise
const page = await pdf.getPage(1)   // page 1 = first page

const scale    = 2.5   // 2.5× for good OCR resolution
const viewport = page.getViewport({ scale })
const width    = Math.round(viewport.width)
const height   = Math.round(viewport.height)

console.log(`Page   : ${width}×${height}px at ${scale}× scale`)

// ── Create canvas ─────────────────────────────────────────────────────────────
const canvas = createCanvas(width, height)
const ctx    = canvas.getContext("2d")

// Fill white background (PDF pages are transparent by default)
ctx.fillStyle = "#ffffff"
ctx.fillRect(0, 0, width, height)

// ── Render ────────────────────────────────────────────────────────────────────
await page.render({
  canvasContext: ctx,
  viewport,
}).promise

// ── Save PNG ───────────────────────────────────────────────────────────────────
const pngBuffer = canvas.toBuffer("image/png")
fs.writeFileSync(outPath, pngBuffer)
const sizeKB = Math.round(pngBuffer.length / 1024)

console.log(`Done   : ${outPath} (${sizeKB} KB)`)
console.log(`\nNow run the OCR benchmark:`)
console.log(`  node scripts/benchmark-ocr.mjs "${outPath}"`)

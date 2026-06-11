/**
 * lib/ocr/preprocess.ts
 * Client-side canvas preprocessing to improve OCR accuracy.
 * Uses HTML5 Canvas API — browser only.
 *
 * Pipeline:
 *  1. Crop edges  — removes decorative borders / card edges
 *  2. Upscale     — larger canvas = more detail for OCR
 *  3. Grayscale + contrast via CSS filter (GPU-accelerated)
 *  4. Otsu's automatic threshold — adapts to each scan's histogram
 */

/** Compute Otsu's optimal threshold from grayscale pixel data (every 4th byte = R channel after grayscale). */
function otsu(d: Uint8ClampedArray): number {
  const hist = new Array(256).fill(0)
  const total = d.length / 4
  for (let i = 0; i < d.length; i += 4) hist[d[i]]++

  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]

  let sumB = 0, wB = 0, maxVar = 0, threshold = 128
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue
    const wF = total - wB; if (!wF) break
    sumB += t * hist[t]
    const mB = sumB / wB
    const mF = (sum - sumB) / wF
    const v = wB * wF * (mB - mF) ** 2
    if (v > maxVar) { maxVar = v; threshold = t }
  }
  return threshold
}

function process(
  src: HTMLCanvasElement | HTMLImageElement,
  cropFraction: number,
  scale: number,
  contrastPct: number,
  label: string,
): HTMLCanvasElement {
  const srcW = src instanceof HTMLCanvasElement ? src.width  : (src as HTMLImageElement).naturalWidth  || (src as HTMLImageElement).width
  const srcH = src instanceof HTMLCanvasElement ? src.height : (src as HTMLImageElement).naturalHeight || (src as HTMLImageElement).height

  const cx = Math.floor(srcW * cropFraction)
  const cy = Math.floor(srcH * cropFraction)
  const cw = srcW - cx * 2
  const ch = srcH - cy * 2

  const outW = Math.floor(cw * scale)
  const outH = Math.floor(ch * scale)

  console.log(
    `[preprocess:${label}] input=${srcW}×${srcH}` +
    ` | crop=${cropFraction*100}% → ${cw}×${ch}` +
    ` | output=${outW}×${outH}` +
    ` | contrast=${contrastPct}%`,
  )

  const canvas = document.createElement("canvas")
  canvas.width  = outW
  canvas.height = outH
  const ctx = canvas.getContext("2d")!

  // Grayscale + contrast in one GPU pass
  ctx.filter = `grayscale(100%) contrast(${contrastPct}%)`
  ctx.drawImage(src, cx, cy, cw, ch, 0, 0, outW, outH)
  ctx.filter = "none"

  // Otsu's automatic threshold — adapts to each scan's actual histogram
  const img = ctx.getImageData(0, 0, outW, outH)
  const d   = img.data
  const t   = otsu(d)
  console.log(`[preprocess:${label}] Otsu threshold: ${t}`)

  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] > t ? 255 : 0
    d[i] = d[i + 1] = d[i + 2] = v
  }

  const total  = outW * outH
  const blacks = Array.from({ length: total }, (_, i) => img.data[i * 4]).filter(v => v === 0).length
  const pct    = ((blacks / total) * 100).toFixed(1)
  console.log(`[preprocess:${label}] black pixels: ${pct}% (ideal 3–25% for dark text on light bg)`)

  ctx.putImageData(img, 0, 0)
  return canvas
}

/**
 * Tunisian CIN / passport card.
 * - 3% edge crop removes physical card border
 * - Moderate contrast (180%) — avoids over-darkening noisy scans
 * - Otsu's threshold auto-adapts to each card's scan quality
 * - 2× upscale (2.5× was too large, caused Tesseract "image too small" strips)
 */
export function preprocessCIN(src: HTMLCanvasElement | HTMLImageElement): HTMLCanvasElement {
  return process(src, 0.03, 2, 180, "CIN")
}

/**
 * BAC / university transcript (arabesque-bordered scanned page).
 * - 8% edge crop removes the decorative border entirely
 * - Moderate contrast (200%) sharpens the grade table without over-darkening
 * - Otsu's threshold handles variable scan qualities
 * - 2× upscale
 */
export function preprocessTranscript(src: HTMLCanvasElement | HTMLImageElement): HTMLCanvasElement {
  return process(src, 0.08, 2, 200, "transcript")
}

/**
 * Transcript for vision LLMs — grayscale only, NO binary threshold.
 * Vision models need the gradient information to distinguish Arabic letterforms.
 * Binary threshold removes context that causes subject hallucination.
 */
export function preprocessTranscriptForVL(src: HTMLCanvasElement | HTMLImageElement): HTMLCanvasElement {
  const srcW = src instanceof HTMLCanvasElement ? src.width  : (src as HTMLImageElement).naturalWidth  || (src as HTMLImageElement).width
  const srcH = src instanceof HTMLCanvasElement ? src.height : (src as HTMLImageElement).naturalHeight || (src as HTMLImageElement).height
  const cx = Math.floor(srcW * 0.08), cy = Math.floor(srcH * 0.08)
  const cw = srcW - cx * 2,          ch = srcH - cy * 2
  const outW = cw * 2,               outH = ch * 2
  console.log(`[preprocess:transcript-vl] input=${srcW}×${srcH} | crop=8% → output=${outW}×${outH} (grayscale, no threshold)`)
  const canvas = document.createElement("canvas")
  canvas.width = outW; canvas.height = outH
  const ctx = canvas.getContext("2d")!
  ctx.filter = "grayscale(100%) contrast(160%)"
  ctx.drawImage(src, cx, cy, cw, ch, 0, 0, outW, outH)
  ctx.filter = "none"
  return canvas
}

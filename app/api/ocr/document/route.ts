// app/api/ocr/document/route.ts
// POST — server-side OCR using Qwen2.5-VL.
// Client sends: { imageBase64: string, documentType: "CIN_PASSPORT" | "TRANSCRIPT" }
// Returns:      { success, data, fallback, confidence }
//
// If Qwen2.5-VL is unavailable → returns { success: false, fallback: true }
// so the client can fall back to its existing Tesseract code path.

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import {
  parseCINWithVL,
  parseTranscriptWithVL,
  stripDataUri,
  type CINResult,
  type TranscriptResult,
} from "@/lib/ocr/vl-ocr"

export type OCRDocumentType = "CIN_PASSPORT" | "TRANSCRIPT"

export interface OCRResponse {
  success:    boolean
  fallback:   boolean          // true → client should use Tesseract
  data:       CINResult | TranscriptResult | null
  confidence: "HIGH" | "MEDIUM" | "LOW" | null
  error?:     string
}

export async function POST(req: NextRequest): Promise<NextResponse<OCRResponse>> {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ success: false, fallback: true, data: null, confidence: null, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json() as { imageBase64?: string; documentType?: OCRDocumentType; sousType?: string }
    const { imageBase64, documentType, sousType } = body

    if (!imageBase64 || !documentType) {
      return NextResponse.json(
        { success: false, fallback: true, data: null, confidence: null, error: "imageBase64 and documentType are required" },
        { status: 400 }
      )
    }

    // Strip data URI prefix if client sent a full data URL
    const rawBase64 = stripDataUri(imageBase64)

    let data: CINResult | TranscriptResult | null = null

    if (documentType === "CIN_PASSPORT") {
      data = await parseCINWithVL(rawBase64)
    } else if (documentType === "TRANSCRIPT") {
      data = await parseTranscriptWithVL(rawBase64, sousType ?? null)
    } else {
      return NextResponse.json(
        { success: false, fallback: true, data: null, confidence: null, error: `Unknown documentType: ${documentType}` },
        { status: 400 }
      )
    }

    if (!data) {
      // VLM failed or Ollama unreachable — tell client to use Tesseract
      return NextResponse.json({ success: false, fallback: true, data: null, confidence: null })
    }

    return NextResponse.json({
      success:    true,
      fallback:   false,
      data,
      confidence: data.confidence,
    })
  } catch (err) {
    console.error("[POST /api/ocr/document]", err)
    return NextResponse.json({ success: false, fallback: true, data: null, confidence: null })
  }
}

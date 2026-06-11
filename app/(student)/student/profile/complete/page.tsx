"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n-context"
import { parseDocumentText } from "@/lib/ocr/documentParser"
import { preprocessCIN } from "@/lib/ocr/preprocess"

interface ProfileForm {
  dateNaissance:  string
  typeIdentite:   "CIN" | "PASSEPORT"
  numeroIdentite: string
  pays:           string
  telephone:      string
  adresse:        string
}

const EMPTY: ProfileForm = {
  dateNaissance: "", typeIdentite: "CIN",
  numeroIdentite: "", pays: "", telephone: "", adresse: "",
}

const inp: React.CSSProperties = {
  width: "100%", padding: "11px 14px", fontSize: "14px", color: "#f8fafc",
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "12px", outline: "none", boxSizing: "border-box",
  fontFamily: "inherit", transition: "border-color 0.2s",
}
const inpGold: React.CSSProperties = {
  ...inp, borderColor: "rgba(245,200,66,0.45)", background: "rgba(245,200,66,0.06)",
}
const lbl: React.CSSProperties = {
  display: "block", fontSize: "10.5px", fontWeight: 700,
  letterSpacing: "0.1em", textTransform: "uppercase",
  color: "#64748b", marginBottom: "7px",
}

export default function ProfileCompletePage() {
  const router      = useRouter()
  const { refresh } = useAuth()
  const { t }       = useI18n()

  const [form, setForm]             = useState<ProfileForm>(EMPTY)
  const [prefilled, setPrefilled]   = useState<Set<string>>(new Set())
  const [scanning, setScanning]     = useState(false)
  const [scanProgress, setProgress] = useState(0)
  const [scanMsg, setScanMsg]       = useState("")
  const [scanError, setScanError]   = useState("")
  const [scanDone, setScanDone]     = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  function upd(field: keyof ProfileForm, value: string) {
    setForm((p) => ({ ...p, [field]: value }))
    setPrefilled((p) => { const n = new Set(p); n.delete(field); return n })
  }

  // ── File → base64 (handles both PDF and images) ─────────────────────────
  async function fileToBase64(file: File): Promise<string> {
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const pdfjsLib = await import("pdfjs-dist")
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
      const buf = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: buf, wasmUrl: "/wasm/" } as Parameters<typeof pdfjsLib.getDocument>[0]).promise
      console.log(`[pdfjs:CIN] loaded, numPages=${pdf.numPages}`)
      const page = await pdf.getPage(1)
      const vp = page.getViewport({ scale: 3 })
      const canvas = document.createElement("canvas")
      canvas.width = vp.width; canvas.height = vp.height
      await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp, canvas }).promise
      console.log(`[pdfjs:CIN] canvas ${canvas.width}×${canvas.height}`)
      return preprocessCIN(canvas).toDataURL("image/png")
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function handleScan(file: File) {
    if (scanning) return
    setScanning(true); setScanError(""); setScanDone(false); setProgress(10)
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)

    // Always store the raw file in session storage for the dossier/new step
    try {
      const reader = new FileReader()
      reader.onload = () => {
        try {
          sessionStorage.setItem("cin_doc_base64", reader.result as string)
          sessionStorage.setItem("cin_doc_name", file.name)
          sessionStorage.setItem("cin_doc_type", file.type)
        } catch { /* ignore */ }
      }
      reader.readAsDataURL(file)
    } catch { /* ignore */ }

    try {
      // ── Step 1: convert to base64 ────────────────────────────────────────
      setProgress(20)
      const imageBase64 = await fileToBase64(file)
      setPreviewUrl(imageBase64)
      setProgress(40)

      // ── Step 2: try Qwen2.5-VL via server API ────────────────────────────
      let vlSucceeded = false
      try {
        const res = await fetch("/api/ocr/document", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64, documentType: "CIN_PASSPORT" }),
        })
        if (res.ok) {
          const { success, data } = await res.json() as { success: boolean; data: { idNumber?: string; fullName?: string; dateOfBirth?: string; address?: string; documentType?: string; nationality?: string } | null }
          if (success && data) {
            setProgress(90)
            const newForm    = { ...form }
            const newPrefill = new Set<string>()
            const map: Record<string, string | null | undefined> = {
              numeroIdentite: data.idNumber,
              dateNaissance:  data.dateOfBirth,
              adresse:        data.address,
              pays:           data.nationality?.toLowerCase().includes("tun") ? "Tunisie" : (data.nationality ?? null),
              typeIdentite:   data.documentType === "PASSEPORT" ? "PASSEPORT" : data.documentType === "CIN" ? "CIN" : null,
            }
            for (const [key, value] of Object.entries(map)) {
              if (value) { ;(newForm as Record<string,string>)[key] = value; newPrefill.add(key) }
            }
            setForm(newForm); setPrefilled(newPrefill); setScanDone(true)
            setScanMsg(newPrefill.size > 0
              ? `${newPrefill.size} champ(s) extrait(s) par analyse IA`
              : "Document analysé — vérifiez et complétez les champs")
            vlSucceeded = true
          }
        }
      } catch { /* VL unavailable — fall through to Tesseract */ }

      // ── Step 3: Tesseract fallback ────────────────────────────────────────
      if (!vlSucceeded) {
        console.log("[profile scan] VL failed — using Tesseract fallback")
        setProgress(45)
        const { createWorker } = await import("tesseract.js")
        const worker = await createWorker("ara+fra+eng", 1, {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === "recognizing text") setProgress(Math.round(50 + m.progress * 45))
          },
        })
        // Build canvas/file target from the already-computed base64
        const img = new Image()
        await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = imageBase64 })
        const raw = document.createElement("canvas")
        raw.width = img.width; raw.height = img.height
        raw.getContext("2d")!.drawImage(img, 0, 0)
        const { data } = await worker.recognize(preprocessCIN(raw))
        await worker.terminate()
        setProgress(100)
        console.log("[tesseract:CIN] confidence:", data.confidence)
        console.log("[tesseract:CIN] raw text:\n---\n" + data.text + "\n---")
        if (!data.text.trim()) throw new Error("Aucun texte détecté dans le document.")
        const extracted  = parseDocumentText(data.text)
        console.log("[tesseract:CIN] parsed fields:", extracted)
        const newForm    = { ...form }
        const newPrefill = new Set<string>()
        const fieldMap: Partial<Record<keyof ProfileForm, string | null>> = {
          dateNaissance:  extracted.dateNaissance,
          typeIdentite:   extracted.typeIdentite as "CIN" | "PASSEPORT" | null,
          numeroIdentite: extracted.numeroIdentite,
          adresse:        extracted.adresse,
          pays:           extracted.pays,
        }
        for (const [key, value] of Object.entries(fieldMap)) {
          if (value) { ;(newForm as Record<string,string>)[key] = value; newPrefill.add(key) }
        }
        setForm(newForm); setPrefilled(newPrefill); setScanDone(true)
        setScanMsg(newPrefill.size > 0
          ? t("student.profile.scan.prefilled", { count: String(newPrefill.size) })
          : t("student.profile.scan.docAnalyzed"))
      }
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : t("common.error"))
    } finally { setScanning(false) }
  }

  async function handleSave() {
    setSaving(true); setError("")
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateNaissance:  form.dateNaissance  || undefined,
          typeIdentite:   form.typeIdentite   || undefined,
          numeroIdentite: form.numeroIdentite || undefined,
          pays:           form.pays           || undefined,
          telephone:      form.telephone      || undefined,
          adresse:        form.adresse        || undefined,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? t("common.error")) }
      await refresh()
      router.push("/student/dossier/new")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("common.error"))
    } finally { setSaving(false) }
  }

  const isGold = (f: string) => prefilled.has(f)

  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "40px 36px", maxWidth: "680px", margin: "0 auto" }}>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
        .pf:focus { border-color: #e8b820 !important; box-shadow: 0 0 0 3px rgba(232,184,32,0.18) !important; }
        .pf::placeholder { color: #334155; }
        .sel-dark option  { background: #0f1e3d; color: #f8fafc; }
        .dz:hover { border-color: rgba(245,200,66,0.45) !important; background: rgba(245,200,66,0.04) !important; }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: "26px", fontWeight: 600, color: "#f8fafc", margin: "0 0 6px" }}>
          {t("student.profile.title")}
        </h1>
        <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
          {t("student.profile.subtitle")}
        </p>
      </div>

      {/* Scan zone */}
      <div style={{ marginBottom: "20px", borderRadius: "16px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <label className="dz" style={{ display: "block", padding: "24px", cursor: scanning ? "not-allowed" : "pointer", transition: "all 0.2s", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <input ref={fileRef} type="file" accept=".pdf,application/pdf"
            style={{ display: "none" }} disabled={scanning}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleScan(f) }}/>

          {scanning ? (
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.9s linear infinite", flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" stroke="#f5c842" strokeWidth="2" strokeOpacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="#f5c842" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <div style={{ flex: 1 }}>
                <div style={{ height: "3px", borderRadius: "3px", background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: "8px" }}>
                  <div style={{ height: "100%", width: `${scanProgress}%`, background: "linear-gradient(90deg,#f5c842,#e8a820)", borderRadius: "3px", transition: "width 0.3s ease" }}/>
                </div>
                <div style={{ fontSize: "13px", color: "#64748b" }}>{t("student.profile.scan.analyzing", { progress: String(scanProgress) })}</div>
              </div>
            </div>
          ) : previewUrl && scanDone ? (
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <img src={previewUrl} alt="" style={{ width: "64px", height: "44px", objectFit: "cover", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}/>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#4ade80" }}>✓ {scanMsg}</div>
                <div style={{ fontSize: "12px", color: "#475569", marginTop: "3px" }}>{t("student.profile.scan.clickToScanAnother")}</div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>📷</div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "#f8fafc" }}>{t("student.profile.scan.title")}</div>
                <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>{t("student.profile.scan.subtitle")}</div>
              </div>
            </div>
          )}
        </label>

        {scanError && (
          <div style={{ padding: "12px 20px", fontSize: "13px", color: "#fca5a5", background: "rgba(239,68,68,0.08)", borderTop: "1px solid rgba(239,68,68,0.15)" }}>
            {scanError}
          </div>
        )}

        {prefilled.size > 0 && !scanning && (
          <div style={{ padding: "10px 20px", fontSize: "12px", color: "#f5c842", background: "rgba(245,200,66,0.06)", animation: "fadeIn 0.3s ease both" }}>
            {t("student.profile.scan.highlightedNote")}
          </div>
        )}
      </div>

      {/* Form */}
      <div style={{ padding: "28px 30px", borderRadius: "16px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: "20px" }}>
        {error && (
          <div style={{ marginBottom: "18px", padding: "11px 14px", borderRadius: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", fontSize: "13px", color: "#fca5a5" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={lbl}>{t("student.profile.form.dateNaissance")}</label>
            <input type="date" value={form.dateNaissance} onChange={(e) => upd("dateNaissance", e.target.value)}
              className="pf" style={{ ...(isGold("dateNaissance") ? inpGold : inp), colorScheme: "dark" }}/>
          </div>

          <div>
            <label style={lbl}>{t("student.profile.form.typeIdentite")}</label>
            <div style={{ display: "flex", borderRadius: "10px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", marginBottom: "10px" }}>
              {(["CIN", "PASSEPORT"] as const).map((type, i) => (
                <button key={type} onClick={() => upd("typeIdentite", type)} style={{ flex: 1, padding: "10px 8px", border: "none", borderRight: i === 0 ? "1px solid rgba(255,255,255,0.1)" : "none", fontFamily: "inherit", background: form.typeIdentite === type ? "rgba(245,200,66,0.12)" : "rgba(255,255,255,0.03)", color: form.typeIdentite === type ? "#f5c842" : "#64748b", fontSize: "13px", fontWeight: form.typeIdentite === type ? 700 : 400, cursor: "pointer", transition: "all 0.15s" }}>
                  {type === "CIN" ? t("student.profile.form.cin") : t("student.profile.form.passeport")}
                </button>
              ))}
            </div>
            <input value={form.numeroIdentite} onChange={(e) => upd("numeroIdentite", e.target.value)}
              placeholder={form.typeIdentite === "CIN" ? t("student.profile.form.numCin") : t("student.profile.form.numPasseport")}
              className="pf" style={isGold("numeroIdentite") ? inpGold : inp}/>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={lbl}>{t("student.profile.form.pays")}</label>
              <input value={form.pays} onChange={(e) => upd("pays", e.target.value)}
                placeholder={t("student.profile.form.paysPlaceholder")} className="pf" style={isGold("pays") ? inpGold : inp}/>
            </div>
            <div>
              <label style={lbl}>{t("student.profile.form.telephone")}</label>
              <input type="tel" value={form.telephone} onChange={(e) => upd("telephone", e.target.value)}
                placeholder={t("student.profile.form.telephonePlaceholder")} className="pf" style={inp}/>
            </div>
          </div>

          <div>
            <label style={lbl}>{t("student.profile.form.adresse")}</label>
            <textarea value={form.adresse} onChange={(e) => upd("adresse", e.target.value)}
              placeholder={t("student.profile.form.adressePlaceholder")}
              rows={2} className="pf"
              style={{ ...(isGold("adresse") ? inpGold : inp), resize: "vertical" }}/>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={() => router.push("/student/dashboard")} style={{ padding: "11px 20px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#64748b", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>
          {t("student.profile.later")}
        </button>
        <button onClick={handleSave} disabled={saving} style={{ padding: "13px 32px", borderRadius: "12px", border: "none", background: saving ? "rgba(232,184,32,0.45)" : "linear-gradient(135deg,#f5c842,#e8a820)", color: "#060d1f", fontSize: "14px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: saving ? "none" : "0 6px 24px rgba(232,184,32,0.28)", display: "flex", alignItems: "center", gap: "8px" }}>
          {saving ? (
            <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.8s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="#060d1f" strokeWidth="3" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#060d1f" strokeWidth="3" strokeLinecap="round"/></svg>{t("common.saving")}</>
          ) : t("common.save")}
        </button>
      </div>
    </div>
  )
}

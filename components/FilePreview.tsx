"use client"

// Small inline preview shown when a file is selected.
// Images → actual thumbnail. PDFs → red PDF badge. Others → generic file icon.

interface FilePreviewProps {
  file: File
  size?: number   // px, default 52
}

export default function FilePreview({ file, size = 52 }: FilePreviewProps) {
  const isImage = file.type.startsWith("image/")
  const url     = URL.createObjectURL(file)

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" title="Voir l'image" style={{ flexShrink: 0 }}>
        <img
          src={url}
          alt={file.name}
          style={{
            width: size, height: size, objectFit: "cover",
            borderRadius: "8px", display: "block",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}
        />
      </a>
    )
  }

  // PDF or other — show a clickable badge
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  return (
    <a
      href={url} target="_blank" rel="noopener noreferrer"
      title="Voir le document"
      style={{
        width: size, height: size, flexShrink: 0,
        borderRadius: "8px", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: "3px",
        background: isPdf ? "rgba(248,113,113,0.12)" : "rgba(96,165,250,0.1)",
        border: `1px solid ${isPdf ? "rgba(248,113,113,0.3)" : "rgba(96,165,250,0.25)"}`,
        textDecoration: "none",
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        cursor: "pointer",
      }}
    >
      {isPdf ? (
        <>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#f87171" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>
          </svg>
          <span style={{ fontSize: "8px", fontWeight: 700, color: "#f87171", letterSpacing: "0.04em" }}>PDF</span>
        </>
      ) : (
        <>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#60a5fa" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13"/>
          </svg>
          <span style={{ fontSize: "8px", fontWeight: 700, color: "#60a5fa" }}>FILE</span>
        </>
      )}
    </a>
  )
}

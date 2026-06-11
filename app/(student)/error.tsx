"use client"

// app/(student)/error.tsx
// Catches errors within the student space without crashing the whole app.

export default function StudentError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ minHeight: "100vh", background: "#070e20", display: "flex", alignItems: "center", justifyContent: "center", padding: "36px" }}>
      <style>{`@keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>
      <div style={{ maxWidth: "460px", width: "100%", animation: "fadeUp 0.35s ease both" }}>
        <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", marginBottom: "22px" }}>
          ⚠️
        </div>
        <h2 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: "22px", fontWeight: 600, color: "#f8fafc", margin: "0 0 10px" }}>
          Une erreur est survenue
        </h2>
        <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "24px", lineHeight: 1.65 }}>
          {error.message || "Impossible de charger cette page. Réessayez ou revenez au tableau de bord."}
        </p>
        {error.digest && (
          <p style={{ fontSize: "11px", color: "#334155", fontFamily: "monospace", padding: "7px 11px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", marginBottom: "20px" }}>
            Réf : {error.digest}
          </p>
        )}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={reset}
            style={{ padding: "11px 24px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#f5c842,#e8a820)", color: "#060d1f", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >
            Réessayer
          </button>
          <button
            onClick={() => { window.location.href = "/student/dashboard" }}
            style={{ padding: "11px 20px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#94a3b8", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}
          >
            Tableau de bord
          </button>
        </div>
      </div>
    </div>
  )
}
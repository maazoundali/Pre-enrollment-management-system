// app/(admin)/admin/dossiers/loading.tsx
import { SkeletonRow, ShimmerStyles } from "@/components/Skeleton"

export default function DossiersLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "32px 36px" }}>
      <ShimmerStyles/>
      <div style={{ marginBottom: 32 }}>
        <div style={{ height: 28, width: 160, borderRadius: 8, ...sh, marginBottom: 10 }}/>
        <div style={{ height: 13, width: 120, borderRadius: 6, ...sh }}/>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <div style={{ height: 40, width: 400, borderRadius: 12, ...sh }}/>
        <div style={{ height: 40, flex: 1, borderRadius: 10, ...sh }}/>
      </div>
      <div style={{ borderRadius: "18px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <div style={{ height: 44, borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)" }}/>
        {[1,2,3,4,5].map((i) => <SkeletonRow key={i}/>)}
      </div>
    </div>
  )
}

const sh: React.CSSProperties = {
  background: "linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.05) 75%)",
  backgroundSize: "200% 100%", animation: "shimmer 1.6s ease-in-out infinite",
}
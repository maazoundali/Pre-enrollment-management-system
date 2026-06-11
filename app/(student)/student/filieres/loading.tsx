// app/(student)/student/filieres/loading.tsx
import { SkeletonFiliereCard, ShimmerStyles } from "@/components/Skeleton"

export default function FilieresLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "36px 40px" }}>
      <ShimmerStyles/>
      <div style={{ marginBottom: 32 }}>
        <div style={{ height: 28, width: 220, borderRadius: 8, ...shimmer, marginBottom: 10 }}/>
        <div style={{ height: 13, width: 180, borderRadius: 6, ...shimmer }}/>
      </div>
      <div style={{ height: 40, width: 380, borderRadius: 12, ...shimmer, marginBottom: 28 }}/>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[1,2,3,4].map((i) => <SkeletonFiliereCard key={i}/>)}
      </div>
    </div>
  )
}

const shimmer: React.CSSProperties = {
  background: "linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.05) 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.6s ease-in-out infinite",
}
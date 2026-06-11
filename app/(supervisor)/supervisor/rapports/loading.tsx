// app/(supervisor)/supervisor/rapports/loading.tsx
import { Skeleton, ShimmerStyles } from "@/components/Skeleton"

export default function RapportsLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "32px 36px" }}>
      <ShimmerStyles/>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
        <div>
          <Skeleton height={28} width="140px" radius={8} style={{ marginBottom: 10 }}/>
          <Skeleton height={13} width="320px" radius={6}/>
        </div>
        <Skeleton height={42} width="160px" radius={12}/>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {[1,2,3].map((i) => (
          <div key={i} style={{ borderRadius: "18px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.07)", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <Skeleton height={15} width="240px" radius={6} style={{ marginBottom: 10 }}/>
              <Skeleton height={12} width="320px" radius={5}/>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Skeleton height={32} width="70px" radius={8}/>
              <Skeleton height={32} width="70px" radius={8}/>
              <Skeleton height={32} width="32px" radius={8}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
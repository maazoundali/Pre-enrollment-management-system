// app/(student)/student/dossier/[id]/loading.tsx
import { Skeleton, ShimmerStyles } from "@/components/Skeleton"

export default function DossierDetailLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "32px 36px" }}>
      <ShimmerStyles/>
      <Skeleton height={13} width="80px" radius={6} style={{ marginBottom: 24 }}/>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <Skeleton height={26} width="300px" radius={8} style={{ marginBottom: 10 }}/>
          <Skeleton height={13} width="180px" radius={6}/>
        </div>
        <Skeleton height={32} width="100px" radius={20}/>
      </div>

      {/* Timeline */}
      <div style={{ padding: "24px 28px", borderRadius: "18px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 20 }}>
        <Skeleton height={11} width="120px" radius={5} style={{ marginBottom: 20 }}/>
        <div style={{ display: "flex", alignItems: "center" }}>
          {[0,1,2,3].map((i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: i < 3 ? 1 : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <Skeleton width={30} height={30} radius={15}/><Skeleton width={55} height={10} radius={5}/>
              </div>
              {i < 3 && <Skeleton height={2} style={{ flex: 1, margin: "0 4px 18px" }}/>}
            </div>
          ))}
        </div>
      </div>

      {/* Filière + Documents */}
      {[300, 200].map((w, i) => (
        <div key={i} style={{ padding: "24px 28px", borderRadius: "18px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 20 }}>
          <Skeleton height={14} width={w} radius={6} style={{ marginBottom: 20 }}/>
          {[80, 60, 70, 50].map((pct, j) => (
            <Skeleton key={j} height={12} width={`${pct}%`} radius={5} style={{ marginBottom: 10 }}/>
          ))}
        </div>
      ))}
    </div>
  )
}
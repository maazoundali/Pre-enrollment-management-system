// app/(admin)/admin/dossiers/[id]/loading.tsx
import { Skeleton, SkeletonInfoField, ShimmerStyles } from "@/components/Skeleton"

export default function DossierDetailLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "32px 36px" }}>
      <ShimmerStyles/>
      <Skeleton height={13} width="120px" radius={6} style={{ marginBottom: 24 }}/>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <Skeleton height={26} width="260px" radius={8} style={{ marginBottom: 10 }}/>
          <Skeleton height={13} width="200px" radius={6}/>
        </div>
        <Skeleton height={32} width="100px" radius={20}/>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
        <div>
          {/* Identity card */}
          <div style={{ padding: "24px 28px", borderRadius: "18px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 20 }}>
            <Skeleton height={14} width="120px" radius={6} style={{ marginBottom: 20 }}/>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[1,2,3,4,5,6,7,8].map((i) => <SkeletonInfoField key={i}/>)}
            </div>
          </div>
          {/* Academic card */}
          <div style={{ padding: "24px 28px", borderRadius: "18px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 20 }}>
            <Skeleton height={14} width="180px" radius={6} style={{ marginBottom: 20 }}/>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[1,2,3,4,5,6].map((i) => <SkeletonInfoField key={i}/>)}
            </div>
          </div>
          {/* Documents card */}
          <div style={{ padding: "24px 28px", borderRadius: "18px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <Skeleton height={14} width="140px" radius={6} style={{ marginBottom: 20 }}/>
            {[1,2,3].map((i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <Skeleton height={22} width="80px" radius={6}/><Skeleton height={13} width="120px" radius={5}/>
                </div>
                <Skeleton height={26} width="50px" radius={6}/>
              </div>
            ))}
          </div>
        </div>

        {/* Action panel */}
        <div style={{ padding: 24, borderRadius: 18, background: "rgba(10,20,42,0.8)", border: "1px solid rgba(255,255,255,0.08)", height: "fit-content" }}>
          <Skeleton height={14} width="80px" radius={6} style={{ marginBottom: 20 }}/>
          <Skeleton height={48} radius={12} style={{ marginBottom: 10 }}/>
          <Skeleton height={48} radius={12}/>
        </div>
      </div>
    </div>
  )
}
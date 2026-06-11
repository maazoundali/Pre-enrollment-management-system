// app/(supervisor)/supervisor/dashboard/loading.tsx
import { Skeleton, ShimmerStyles } from "@/components/Skeleton"

export default function SupervisorDashboardLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "32px 36px" }}>
      <ShimmerStyles/>
      <div style={{ marginBottom: "36px" }}>
        <Skeleton height={28} width="200px" radius={8} style={{ marginBottom: 10 }}/>
        <Skeleton height={13} width="280px" radius={6}/>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "28px" }}>
        {[1,2,3,4].map((i) => (
          <div key={i} style={{ padding: "24px 28px", borderRadius: "18px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <Skeleton width={32} height={32} radius={8} style={{ marginBottom: 14 }}/>
            <Skeleton height={30} width="60px" radius={8} style={{ marginBottom: 8 }}/>
            <Skeleton height={11} width="100px" radius={5}/>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
        {[1,2].map((i) => (
          <div key={i} style={{ padding: "24px 28px", borderRadius: "18px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <Skeleton height={16} width="160px" radius={6} style={{ marginBottom: 22 }}/>
            {[1,2,3,4,5].map((j) => (
              <div key={j} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <Skeleton height={12} width="80px" radius={5}/>
                  <Skeleton height={12} width="50px" radius={5}/>
                </div>
                <Skeleton height={5} radius={5}/>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ padding: "24px 28px", borderRadius: "18px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Skeleton height={16} width="180px" radius={6} style={{ marginBottom: 8 }}/>
          <Skeleton height={12} width="300px" radius={5}/>
        </div>
        <Skeleton height={40} width="160px" radius={12}/>
      </div>
    </div>
  )
}
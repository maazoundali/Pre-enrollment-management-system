// app/(admin)/admin/dashboard/loading.tsx
import { Skeleton, ShimmerStyles } from "@/components/Skeleton"

export default function AdminDashboardLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "32px 36px" }}>
      <ShimmerStyles/>

      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <Skeleton height={28} width="220px" radius={8} style={{ marginBottom: 10 }}/>
        <Skeleton height={13} width="160px" radius={6}/>
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "28px" }}>
        {[1,2,3,4].map((i) => (
          <div key={i} style={{ padding: "22px 24px", borderRadius: "16px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <Skeleton height={11} width="80px" radius={5} style={{ marginBottom: 14 }}/>
            <Skeleton height={32} width="60px" radius={8} style={{ marginBottom: 10 }}/>
            <Skeleton height={10} width="100px" radius={5}/>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* Status breakdown */}
        <div style={{ padding: "24px 28px", borderRadius: "18px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <Skeleton height={14} width="140px" radius={6} style={{ marginBottom: 20 }}/>
          {[1,2,3,4,5].map((i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <Skeleton height={12} width="80px" radius={5}/>
                <Skeleton height={12} width="30px" radius={5}/>
              </div>
              <Skeleton height={6} radius={6}/>
            </div>
          ))}
        </div>

        {/* Recent activity */}
        <div style={{ padding: "24px 28px", borderRadius: "18px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <Skeleton height={14} width="160px" radius={6} style={{ marginBottom: 20 }}/>
          {[1,2,3,4,5].map((i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "flex-start" }}>
              <Skeleton width={36} height={36} radius={18}/>
              <div style={{ flex: 1 }}>
                <Skeleton height={12} width="70%" radius={5} style={{ marginBottom: 6 }}/>
                <Skeleton height={11} width="40%" radius={5}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
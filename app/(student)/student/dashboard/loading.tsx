// app/(student)/student/dashboard/loading.tsx
import { Skeleton, ShimmerStyles } from "@/components/Skeleton"

export default function DashboardLoading() {
  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "36px 40px" }}>
      <ShimmerStyles/>

      {/* Greeting */}
      <div style={{ marginBottom: "36px" }}>
        <Skeleton height={12} width="160px" radius={6} style={{ marginBottom: 10 }}/>
        <Skeleton height={28} width="280px" radius={8}/>
      </div>

      {/* Dossier card */}
      <div style={{ maxWidth: "640px", padding: "30px 32px", borderRadius: "20px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <Skeleton height={11} width="80px" radius={5} style={{ marginBottom: 10 }}/>
            <Skeleton height={20} width="260px" radius={7} style={{ marginBottom: 8 }}/>
            <Skeleton height={12} width="120px" radius={5}/>
          </div>
          <Skeleton height={28} width="90px" radius={20}/>
        </div>
        <Skeleton height={13} width="85%" radius={6} style={{ marginBottom: 6 }}/>
        <Skeleton height={13} width="60%" radius={6} style={{ marginBottom: 24 }}/>

        {/* Timeline */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
          {[0,1,2,3].map((i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: i < 3 ? 1 : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <Skeleton width={30} height={30} radius={15}/>
                <Skeleton width={50} height={10} radius={5}/>
              </div>
              {i < 3 && <Skeleton height={2} style={{ flex: 1, margin: "0 4px 20px" }}/>}
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Skeleton height={12} width="120px" radius={5}/>
          <div style={{ display: "flex", gap: 8 }}>
            <Skeleton height={30} width="100px" radius={8}/>
            <Skeleton height={30} width="80px" radius={8}/>
          </div>
        </div>
      </div>
    </div>
  )
}
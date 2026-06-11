// components/Skeleton.tsx
// Shimmer skeleton primitives — reused across all loading states.

const BASE: React.CSSProperties = {
  background: "linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.05) 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.6s ease-in-out infinite",
  flexShrink: 0,
}

interface SkeletonProps {
  width?:  string | number
  height?: string | number
  radius?: string | number
  style?:  React.CSSProperties
}

export function Skeleton({ width = "100%", height = 16, radius = 8, style }: SkeletonProps) {
  return <div style={{ ...BASE, width, height, borderRadius: radius, ...style }}/>
}

export function SkeletonCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ padding: "24px 28px", borderRadius: "18px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.07)", ...style }}>
      {children}
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 80px 100px", padding: "14px 20px", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", gap: "8px" }}>
      <div><Skeleton height={13} width="60%" radius={6} style={{ marginBottom: 6 }}/><Skeleton height={11} width="40%" radius={5}/></div>
      <Skeleton height={13} width="50%" radius={6}/>
      <Skeleton height={13} width="40px" radius={6}/>
      <Skeleton height={13} width="50px" radius={6}/>
      <Skeleton height={22} width="60px" radius={20}/>
      <Skeleton height={28} width="80px" radius={8}/>
    </div>
  )
}

export function SkeletonFiliereCard() {
  return (
    <div style={{ padding: "20px 24px", borderRadius: "16px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <Skeleton height={16} width="40%" radius={6}/><Skeleton height={14} width="80px" radius={6}/>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Skeleton height={20} width="80px" radius={20}/><Skeleton height={20} width="60px" radius={20}/><Skeleton height={20} width="70px" radius={20}/>
      </div>
      <Skeleton height={4} radius={4}/>
    </div>
  )
}

export function SkeletonInfoField() {
  return (
    <div style={{ padding: "12px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <Skeleton height={10} width="50%" radius={4} style={{ marginBottom: 8 }}/><Skeleton height={13} width="70%" radius={5}/>
    </div>
  )
}

export function ShimmerStyles() {
  return (
    <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
  )
}

// Alias — some pages import ShimmerStyles as SkeletonStyles
export { ShimmerStyles as SkeletonStyles }

// Dossier card skeleton for student dashboard
export function SkeletonDossierCard() {
  return (
    <div style={{ padding: "30px 32px", borderRadius: "20px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <Skeleton height={11} width="80px" radius={5} style={{ marginBottom: 10 }}/>
          <Skeleton height={20} width="220px" radius={7} style={{ marginBottom: 8 }}/>
          <Skeleton height={12} width="120px" radius={5}/>
        </div>
        <Skeleton height={28} width="90px" radius={20}/>
      </div>
      <Skeleton height={13} width="80%" radius={6} style={{ marginBottom: 6 }}/>
      <Skeleton height={13} width="55%" radius={6} style={{ marginBottom: 24 }}/>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
        {[0,1,2,3].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: i < 3 ? 1 : 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <Skeleton width={30} height={30} radius={15}/><Skeleton width={50} height={10} radius={5}/>
            </div>
            {i < 3 && <Skeleton height={2} style={{ flex: 1, margin: "0 4px 18px" }}/>}
          </div>
        ))}
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16, display: "flex", justifyContent: "space-between" }}>
        <Skeleton height={12} width="110px" radius={5}/>
        <div style={{ display: "flex", gap: 8 }}>
          <Skeleton height={30} width="100px" radius={8}/>
          <Skeleton height={30} width="80px" radius={8}/>
        </div>
      </div>
    </div>
  )
}
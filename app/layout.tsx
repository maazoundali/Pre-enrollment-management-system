import type { Metadata } from "next"
import { Playfair_Display, DM_Sans } from "next/font/google"
import { AuthProvider } from "@/lib/auth-context"
import { I18nProvider } from "@/lib/i18n-context"
import SessionWarningModal from "@/components/SessionWarningModal"
import RouteLoadingBar from "@/components/RouteLoadingBar"
import ChatWidget from "@/components/ChatWidget"
import "./globals.css"

const playfair = Playfair_Display({
  subsets:  ["latin"],
  variable: "--font-playfair",
  display:  "swap",
})

const dmSans = DM_Sans({
  subsets:  ["latin"],
  variable: "--font-dm-sans",
  display:  "swap",
})

export const metadata: Metadata = {
  title:       "IIT — Pré-Inscription",
  description: "Institut International de Technologie — Portail de pré-inscription universitaire",
  icons:       { icon: "/logo.png", apple: "/logo.png" },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <style>{`
          [dir="rtl"] body {
            font-family: "Noto Naskh Arabic", "Arabic UI Text", "Geeza Pro",
              var(--font-dm-sans), system-ui, sans-serif;
          }
          [dir="rtl"] h1, [dir="rtl"] h2, [dir="rtl"] h3 {
            font-family: "Noto Naskh Arabic", "Arabic UI Text", "Geeza Pro", Georgia, serif;
          }
        `}</style>
      </head>
      <body className={`${playfair.variable} ${dmSans.variable} font-sans antialiased`}>
        <I18nProvider>
          <AuthProvider>
            <RouteLoadingBar />
            <SessionWarningModal />
            {children}
            <ChatWidget />
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  )
}

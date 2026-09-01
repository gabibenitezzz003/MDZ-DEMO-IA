import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DemoAssistant } from "@/components/DemoAssistant";
import { DemoBanner } from "@/components/DemoBanner";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { OfficialToast } from "@/components/OfficialToast";
import { ResourceViewerHost } from "@/components/ResourceViewerHost";
import { SessionProvider } from "@/components/SessionProvider";
import { VoiceAssistantBridge } from "@/components/VoiceAssistantBridge";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "DEMO · Dirección de Agricultura | Mendoza",
  description:
    "Demostración de asistente de voz IA sobre la landing de la Dirección de Agricultura de Mendoza.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} demo-watermark antialiased`}
        suppressHydrationWarning
      >
        <SessionProvider>
          <DemoBanner />
          <Header />
          <main className="min-h-[70vh]">{children}</main>
          <Footer />
          <ResourceViewerHost />
          <OfficialToast />
          <VoiceAssistantBridge />
          <DemoAssistant />
        </SessionProvider>
      </body>
    </html>
  );
}

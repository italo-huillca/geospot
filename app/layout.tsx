import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import "driver.js/dist/driver.css";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "GeoSpot AI Arequipa",
  description:
    "Copiloto de IA y geomarketing que encuentra el local comercial óptimo cruzando demografía, vacíos de competencia y oferta inmobiliaria real.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

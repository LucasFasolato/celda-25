import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CELDA 25 – Cárcel del Quincho",
  description: "Terminal penitenciaria. Acceso restringido.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c0e10",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="concrete scanlines antialiased">{children}</body>
    </html>
  );
}

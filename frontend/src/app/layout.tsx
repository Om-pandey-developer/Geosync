import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import TopNavbar from "@/components/TopNavbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "GeoSync — AI-Powered Geospatial Middleware",
  description:
    "Bridge legacy cadastral maps with high-precision drone imagery. " +
    "Smart India Hackathon geospatial middleware for ULPIN generation and revenue workflows.",
  keywords: ["GeoSync", "BhuNaksha", "ULPIN", "Bhu-Aadhaar", "SIH", "cadastral", "PostGIS"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href='https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap' />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body>
        <div className="bg-mesh" />
        <TopNavbar />
        {children}
        <Toaster 
          position="bottom-right" 
          toastOptions={{
            style: {
              background: 'var(--bg-glass-strong)',
              color: 'var(--text-primary)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--border-glass)',
            }
          }} 
        />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

const title = "Video Speed Reader — 上傳影片，幾分鐘內拿到逐字稿";
const description =
  "Upload your video, get a clean transcript in minutes. 上傳影片，幾分鐘內拿到逐字稿。";

export const metadata: Metadata = {
  title,
  description,
  authors: [{ name: "Video Speed Reader" }],
  icons: { icon: "/favicon.ico" },
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Same fonts as the M0 site: Fredoka (display), Nunito (body), Noto Sans TC (Chinese). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;600;700&family=Nunito:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

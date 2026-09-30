import "~/styles/globals.css";

import { type Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";

import ar from "~/messages/ar.json";
import { AppBootLoader } from "~/components/loading";
import { NavProgressBar } from "~/components/loading/nav-progress-bar";

export const metadata: Metadata = {
  title: ar.ui.appName,
  description: "Printex — نظام إدارة مطبعة",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

// research.md §10: RTL/Arabic shell — the root `<html>` sets `dir="rtl"
// lang="ar"` once, here, rather than per-page, to avoid a flash of
// left-to-right content and per-page drift (FR-013).
const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html dir="rtl" lang="ar" className={ibmPlexSansArabic.variable}>
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="font-sans">
        <AppBootLoader>{children}</AppBootLoader>
        {/* 092 T010: non-blocking route progress (never on login — it only
            reacts to pathname changes, and this mount is app-wide anyway). */}
        <NavProgressBar />
      </body>
    </html>
  );
}

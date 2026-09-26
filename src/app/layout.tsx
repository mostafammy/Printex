import "~/styles/globals.css";

import { type Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";

import ar from "~/messages/ar.json";
import { AppBootLoader } from "~/components/loading";

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
      <body className="font-sans">
        <AppBootLoader>{children}</AppBootLoader>
      </body>
    </html>
  );
}

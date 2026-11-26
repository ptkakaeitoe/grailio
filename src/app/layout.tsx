import type { Metadata, Viewport } from "next";
import { DM_Sans, Geist_Mono, Outfit, Syne } from "next/font/google";
import { Providers } from "@/app/providers";
import { BottomTabs, SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/toaster";
import "./globals.css";

/** Type: DM Sans for text, Geist Mono for numbers, Syne for the wordmark (Outfit for the landing headings, below). */
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const syne = Syne({ subsets: ["latin"], variable: "--font-syne", weight: "700" });
/** The landing hero's headline and tagline. */
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  title: { default: "Grailio", template: "%s · Grailio" },
  description: "Memecoin trade fees buy stocks, sealed into packs for holders.",
};

/** Draw under the phone's status bar and home indicator; the header and tab bar pad themselves by the safe areas. */
export const viewport: Viewport = { viewportFit: "cover", themeColor: "#111111" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dmSans.variable} ${geistMono.variable} ${syne.variable} ${outfit.variable} overscroll-y-none antialiased`}>
      <body className="flex min-h-dvh flex-col">
        {/* The soft glow across the top of every page (globals.css, .page-glow). */}
        <div className="page-glow" aria-hidden="true" />
        <Providers>
          <SiteHeader />
          <main id="main-content" className="flex-1">{children}</main>
          {/* Phones leave room under the footer for the tab bar. */}
          <div className="pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] desk:pb-0"><SiteFooter /></div>
          <BottomTabs />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}

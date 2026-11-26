import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stock Packs",
  description: "Memecoin trade fees buy stocks, sealed into packs for holders.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

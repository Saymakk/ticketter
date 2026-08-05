import type { Metadata, Viewport } from "next";
import { Literata, Manrope } from "next/font/google";
import { BottomNav } from "@/components/healthy-life/BottomNav";
import "./globals.css";

const display = Literata({
  variable: "--font-display",
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["500", "600", "700"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  applicationName: "Healthy Life",
  title: {
    default: "Healthy Life",
    template: "%s · Healthy Life",
  },
  description:
    "Мобильный дневник питания: фото еды, ИИ-оценка калорий, вес и советы по прогрессу.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Healthy Life",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/hl-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/hl-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/hl-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/hl-apple-touch.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/icons/hl-192.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#2f6b4f",
};

export default function HealthyLifeLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col text-[var(--ink)]">
        <main className="flex-1">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}

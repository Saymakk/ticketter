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
  title: "Healthy Life — учёт еды и калорий",
  description:
    "Мобильный дневник питания: фото еды, ИИ-оценка калорий, вес и советы по прогрессу.",
  appleWebApp: {
    capable: true,
    title: "Healthy Life",
    statusBarStyle: "default",
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

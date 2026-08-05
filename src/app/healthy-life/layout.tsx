import type { Metadata, Viewport } from "next";
import { Literata, Manrope } from "next/font/google";
import { headers } from "next/headers";
import { BottomNav } from "@/components/healthy-life/BottomNav";
import { HlToastProvider } from "@/components/healthy-life/HlToast";
import { HealthyLifeRoutingProvider } from "@/lib/healthy-life/routing";
import { HealthyLifeI18nProvider } from "@/lib/healthy-life/i18n/provider";
import { getRequestHost } from "@/lib/http/host";
import { isHealthyLifeHost } from "@/lib/healthy-life/hosts";
import "./globals.css";

const display = Literata({
  variable: "--font-display",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  weight: ["500", "600", "700"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  applicationName: "Healthy Life",
  title: {
    default: "Healthy Life",
    template: "%s · Healthy Life",
  },
  description: "Food diary: meal photos, AI calorie estimates, weight, workouts, and medication logging.",
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

export default async function HealthyLifeLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const host = getRequestHost({ headers: h });
  // Dedicated HL host → clean URLs; otherwise keep /healthy-life prefix (local path access).
  const pathPrefix = isHealthyLifeHost(host) ? "" : "/healthy-life";

  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col text-[var(--ink)]">
        <HealthyLifeRoutingProvider prefix={pathPrefix}>
          <HealthyLifeI18nProvider>
            <HlToastProvider>
              <main className="flex-1">{children}</main>
              <BottomNav />
            </HlToastProvider>
          </HealthyLifeI18nProvider>
        </HealthyLifeRoutingProvider>
      </body>
    </html>
  );
}

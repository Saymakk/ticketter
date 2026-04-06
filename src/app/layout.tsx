import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import GlobalRequestLoadingProvider from "@/components/global-request-loading-provider";
import IdleTracker from "@/components/idle-tracker";
import { LocaleProvider } from "@/components/locale-provider";
import LogoutBar from "@/components/logout-bar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ticketter",
  description: "Учёт билетов и сканирование QR",
  icons: {
    icon: "/scanner.png",
    shortcut: "/scanner.png",
    apple: "/scanner.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="min-h-full font-sans antialiased">
        <LocaleProvider>
          <GlobalRequestLoadingProvider>
            <IdleTracker />
            <LogoutBar />
            {children}
          </GlobalRequestLoadingProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}

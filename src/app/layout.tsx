import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
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
          <IdleTracker />
          <LogoutBar />
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}

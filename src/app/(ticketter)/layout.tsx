import type { Metadata } from "next";
import "../globals.css";
import GlobalRequestLoadingProvider from "@/components/global-request-loading-provider";
import IdleTracker from "@/components/idle-tracker";
import { LocaleProvider } from "@/components/locale-provider";
import LogoutBar from "@/components/logout-bar";
import AuthGuard from "@/components/auth-guard";

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
      className="h-full"
    >
      <body className="min-h-full font-sans antialiased">
        <LocaleProvider>
          <GlobalRequestLoadingProvider>
            <AuthGuard />
            <IdleTracker />
            <LogoutBar />
            {children}
          </GlobalRequestLoadingProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}

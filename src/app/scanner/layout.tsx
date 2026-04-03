import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Ticket scanner · Ticketter",
  appleWebApp: {
    capable: true,
    title: "Ticketter Scanner",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d9488",
};

export default function ScannerLayout({ children }: { children: ReactNode }) {
  return children;
}

import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { isHealthyLifeHost } from "@/lib/healthy-life/hosts";
import { getRequestHost } from "@/lib/http/host";

function ticketterManifest(): MetadataRoute.Manifest {
  return {
    name: "Ticketter — сканер билетов",
    short_name: "Сканер",
    description: "Сканирование и пробивка билетов Ticketter",
    start_url: "/scanner",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#0d9488",
    icons: [
      {
        src: "/scanner.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/scanner.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

function healthyLifeManifest(): MetadataRoute.Manifest {
  return {
    name: "Healthy Life",
    short_name: "Healthy Life",
    description: "Дневник питания: фото еды, калории, вес и советы",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3efe6",
    theme_color: "#2f6b4f",
    icons: [
      {
        src: "/icons/hl-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/hl-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/hl-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

/** Hostname-aware web app manifest: Ticketter vs Healthy Life. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const h = await headers();
  const host = getRequestHost({ headers: h });
  if (isHealthyLifeHost(host)) {
    return healthyLifeManifest();
  }
  return ticketterManifest();
}

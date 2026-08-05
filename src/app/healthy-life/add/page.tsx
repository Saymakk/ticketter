"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHlRouting } from "@/lib/healthy-life/routing";

/** Food is added from the Day modal; keep URL for old bookmarks. */
export default function AddPage() {
  const router = useRouter();
  const { path } = useHlRouting();

  useEffect(() => {
    router.replace(path("/"));
  }, [path, router]);

  return null;
}

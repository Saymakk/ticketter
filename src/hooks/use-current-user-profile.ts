"use client";

import { useEffect, useState } from "react";
import { trackedFetch } from "@/lib/http/tracked-fetch";

export type CurrentUserProfileState = {
  email: string | null;
  fullName: string | null;
  phone: string | null;
  companyId: string | null;
  companyName: string | null;
  companyImageUrl: string | null;
  loading: boolean;
};

export function useCurrentUserProfile(enabled: boolean): CurrentUserProfileState {
  const [state, setState] = useState<CurrentUserProfileState>({
    email: null,
    fullName: null,
    phone: null,
    companyId: null,
    companyName: null,
    companyImageUrl: null,
    loading: enabled,
  });

  useEffect(() => {
    if (!enabled) {
      setState({
        email: null,
        fullName: null,
        phone: null,
        companyId: null,
        companyName: null,
        companyImageUrl: null,
        loading: false,
      });
      return;
    }

    let mounted = true;

    async function load(opts?: { showLoading?: boolean }) {
      const showBar = opts?.showLoading !== false;
      if (showBar) {
        setState((s) => ({ ...s, loading: true }));
      }
      try {
        const res = await trackedFetch("/api/me/profile", {
          cache: "no-store",
          credentials: "include",
          trackGlobalLoading: false,
        });
        const json = await res.json().catch(() => ({}));

        if (!mounted) return;

        if (!res.ok) {
          setState({
            email: null,
            fullName: null,
            phone: null,
            companyId: null,
            companyName: null,
            companyImageUrl: null,
            loading: false,
          });
          return;
        }

        setState({
          email: typeof json.email === "string" ? json.email : null,
          fullName: typeof json.fullName === "string" ? json.fullName : null,
          phone: typeof json.phone === "string" ? json.phone : null,
          companyId: typeof json.companyId === "string" ? json.companyId : null,
          companyName: typeof json.companyName === "string" ? json.companyName : null,
          companyImageUrl: typeof json.companyImageUrl === "string" ? json.companyImageUrl : null,
          loading: false,
        });
      } catch {
        if (mounted) {
          setState((s) => ({ ...s, loading: false }));
        }
      }
    }

    void load({ showLoading: true });

    const onFocus = () => void load({ showLoading: false });
    window.addEventListener("focus", onFocus);

    return () => {
      mounted = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled]);

  return state;
}

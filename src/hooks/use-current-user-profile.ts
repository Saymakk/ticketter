"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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

    const supabase = createClient();
    let mounted = true;

    async function load(opts?: { showLoading?: boolean }) {
      const showBar = opts?.showLoading !== false;
      if (showBar) {
        setState((s) => ({ ...s, loading: true }));
      }
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (!user) {
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

        const email = user.email ?? null;
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone, company_id")
          .eq("id", user.id)
          .single();

        if (!mounted) return;

        let companyName: string | null = null;
        let companyImageUrl: string | null = null;
        const companyId = profile?.company_id ?? null;
        if (companyId) {
          const { data: company } = await supabase
            .from("companies")
            .select("name, image_url")
            .eq("id", companyId)
            .maybeSingle();
          if (!mounted) return;
          companyName = company?.name ?? null;
          companyImageUrl = company?.image_url ?? null;
        }

        setState({
          email,
          fullName: profile?.full_name ?? null,
          phone: profile?.phone ?? null,
          companyId,
          companyName,
          companyImageUrl,
          loading: false,
        });
      } catch {
        if (mounted) {
          setState((s) => ({ ...s, loading: false }));
        }
      }
    }

    void load({ showLoading: true });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") return;
      /* Обновление JWT при возврате во вкладку — без перезагрузки профиля и без лишней анимации */
      if (event === "TOKEN_REFRESHED") return;
      void load({ showLoading: false });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [enabled]);

  return state;
}

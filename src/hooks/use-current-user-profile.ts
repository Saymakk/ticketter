"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  beginTrackedOperation,
  endTrackedOperation,
} from "@/lib/http/tracked-fetch";

export type CurrentUserProfileState = {
  email: string | null;
  fullName: string | null;
  phone: string | null;
  loading: boolean;
};

export function useCurrentUserProfile(enabled: boolean): CurrentUserProfileState {
  const [state, setState] = useState<CurrentUserProfileState>({
    email: null,
    fullName: null,
    phone: null,
    loading: enabled,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ email: null, fullName: null, phone: null, loading: false });
      return;
    }

    const supabase = createClient();
    let mounted = true;

    async function load(opts?: { showLoading?: boolean }) {
      const track = opts?.showLoading !== false;
      if (track) {
        setState((s) => ({ ...s, loading: true }));
        beginTrackedOperation();
      }
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!mounted) return;

        if (!user) {
          setState({ email: null, fullName: null, phone: null, loading: false });
          return;
        }

        const email = user.email ?? null;
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", user.id)
          .single();

        if (!mounted) return;

        setState({
          email,
          fullName: profile?.full_name ?? null,
          phone: profile?.phone ?? null,
          loading: false,
        });
      } finally {
        if (track) {
          endTrackedOperation();
        }
      }
    }

    void load({ showLoading: true });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") return;
      void load({ showLoading: false });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [enabled]);

  return state;
}

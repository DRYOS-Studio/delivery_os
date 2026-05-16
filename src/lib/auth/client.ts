"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { createBrowser } from "@/lib/db/client";

type UserState = { user: User | null; loading: boolean };

export function useUser(): UserState {
  const [state, setState] = useState<UserState>({ user: null, loading: true });

  useEffect(() => {
    const supabase = createBrowser();
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (active) setState({ user: data.user, loading: false });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ user: session?.user ?? null, loading: false });
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

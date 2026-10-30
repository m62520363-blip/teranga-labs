"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type BalanceContextValue = {
  /** Nombre de contacts de projets mensuels restants sur la période en cours. */
  balance: number | null;
  quotaLimit: number | null;
  quotaUsed: number | null;
  planName: string | null;
  isSubscribed: boolean;
  setBalance: (value: number) => void;
  reset: () => void;
  refresh: () => Promise<void>;
};

const BalanceContext = createContext<BalanceContextValue>({
  balance: null,
  quotaLimit: null,
  quotaUsed: null,
  planName: null,
  isSubscribed: false,
  setBalance: () => {},
  reset: () => {},
  refresh: async () => {},
});

export function BalanceProvider({
  isAuthed,
  children,
}: {
  isAuthed: boolean;
  children: ReactNode;
}) {
  const [balance, setBalanceState] = useState<number | null>(null);
  const [quotaLimit, setQuotaLimit] = useState<number | null>(null);
  const [quotaUsed, setQuotaUsed] = useState<number | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthed || !isSupabaseConfigured()) return;
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_my_subscription");
    if (!error && data && typeof data === "object") {
      const sub = data as {
        active?: boolean;
        plan_name_fr?: string;
        quota_remaining?: number;
        quota_limit?: number;
        quota_used?: number;
      };
      if (typeof sub.quota_remaining === "number") {
        setBalanceState(sub.quota_remaining);
      }
      if (typeof sub.quota_limit === "number") setQuotaLimit(sub.quota_limit);
      if (typeof sub.quota_used === "number") setQuotaUsed(sub.quota_used);
      setPlanName(sub.plan_name_fr ?? null);
      setIsSubscribed(Boolean(sub.active));
    }
  }, [isAuthed]);

  useEffect(() => {
    setBalanceState(null);
    void refresh();
  }, [refresh]);

  const setBalance = useCallback((value: number) => setBalanceState(value), []);
  const reset = useCallback(() => {
    setBalanceState(null);
    setQuotaLimit(null);
    setQuotaUsed(null);
    setPlanName(null);
    setIsSubscribed(false);
  }, []);

  return (
    <BalanceContext.Provider
      value={{
        balance,
        quotaLimit,
        quotaUsed,
        planName,
        isSubscribed,
        setBalance,
        reset,
        refresh,
      }}
    >
      {children}
    </BalanceContext.Provider>
  );
}

export function useBalance() {
  return useContext(BalanceContext);
}

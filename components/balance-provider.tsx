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
  balance: number | null;
  setBalance: (value: number) => void;
  reset: () => void;
  refresh: () => Promise<void>;
};

const BalanceContext = createContext<BalanceContextValue>({
  balance: null,
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

  const refresh = useCallback(async () => {
    if (!isAuthed || !isSupabaseConfigured()) return;
    const supabase = createClient();
    const { data, error } = await supabase.rpc("get_token_balance");
    if (!error && typeof data === "number") {
      setBalanceState(data);
    }
  }, [isAuthed]);

  useEffect(() => {
    setBalanceState(null);
    refresh();
  }, [refresh]);

  const setBalance = useCallback((value: number) => setBalanceState(value), []);
  const reset = useCallback(() => setBalanceState(null), []);

  return (
    <BalanceContext.Provider value={{ balance, setBalance, reset, refresh }}>
      {children}
    </BalanceContext.Provider>
  );
}

export function useBalance() {
  return useContext(BalanceContext);
}
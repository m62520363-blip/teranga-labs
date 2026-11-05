import { create } from "zustand";

interface UIState {
  showFilters: boolean;
  toggleFilters: () => void;
  theme: "dark";
}

export const useUIStore = create<UIState>((set) => ({
  showFilters: false,
  toggleFilters: () => set((s) => ({ showFilters: !s.showFilters })),
  theme: "dark",
}));
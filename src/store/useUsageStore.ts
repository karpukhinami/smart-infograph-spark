import { create } from "zustand";
import type { UsageRecord } from "@/lib/pricing";

interface UsageState {
  history: UsageRecord[];
  add: (r: UsageRecord) => void;
  reset: () => void;
}

export const useUsageStore = create<UsageState>((set) => ({
  history: [],
  add: (r) => set((s) => ({ history: [...s.history, r].slice(-200) })),
  reset: () => set({ history: [] }),
}));

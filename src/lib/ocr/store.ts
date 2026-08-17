import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Engine, HistoryItem } from "./types";

type SettingsState = {
  engine: Engine;
  language: string;
  showBoxes: boolean;
  setEngine: (engine: Engine) => void;
  setLanguage: (language: string) => void;
  setShowBoxes: (show: boolean) => void;
};

export const useOcrSettings = create<SettingsState>()(
  persist(
    (set) => ({
      engine: "local",
      language: "eng",
      showBoxes: true,
      setEngine: (engine) => set({ engine }),
      setLanguage: (language) => set({ language }),
      setShowBoxes: (showBoxes) => set({ showBoxes }),
    }),
    { name: "folio-settings" },
  ),
);

type HistoryState = {
  items: HistoryItem[];
  push: (item: HistoryItem) => void;
  remove: (id: string) => void;
  clear: () => void;
};

export const useOcrHistory = create<HistoryState>()(
  persist(
    (set, get) => ({
      items: [],
      push: (item) => set({ items: [item, ...get().items.filter((x) => x.id !== item.id)].slice(0, 8) }),
      remove: (id) => set({ items: get().items.filter((x) => x.id !== id) }),
      clear: () => set({ items: [] }),
    }),
    { name: "folio-history" },
  ),
);

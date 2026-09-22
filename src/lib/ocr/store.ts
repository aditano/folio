import { create } from "zustand";
import { persist } from "zustand/middleware";

type SettingsState = {
  language: string;
  setLanguage: (language: string) => void;
};

export const useOcrSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: "eng",
      setLanguage: (language) => set({ language }),
    }),
    { name: "folio-settings" },
  ),
);

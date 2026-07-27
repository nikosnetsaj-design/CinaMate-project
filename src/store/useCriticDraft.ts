import { create } from "zustand";

interface CriticDraftState {
  question: string;
  setQuestion: (question: string) => void;
  consume: () => string;
}

export const useCriticDraft = create<CriticDraftState>((set, get) => ({
  question: "",
  setQuestion: (question) => set({ question }),
  consume: () => {
    const q = get().question;
    set({ question: "" });
    return q;
  },
}));

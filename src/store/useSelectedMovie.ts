import { create } from "zustand";
import type { Movie } from "../types";

interface SelectedMovieState {
  movie: Movie | null;
  open: (movie: Movie) => void;
  close: () => void;
}

export const useSelectedMovie = create<SelectedMovieState>((set) => ({
  movie: null,
  open: (movie) => set({ movie }),
  close: () => set({ movie: null }),
}));

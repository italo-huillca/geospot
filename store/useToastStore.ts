import { create } from 'zustand';

export type Tone = 'success' | 'warning' | 'error';
interface Toast {
  id: number;
  tone: Tone;
  text: string;
}

let nextId = 1;

export const useToastStore = create<{
  toasts: Toast[];
  push: (tone: Tone, text: string) => void;
}>((set) => ({
  toasts: [],
  push: (tone, text) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, tone, text }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4500);
  },
}));

// Utilizable fuera de React (hooks, workers callbacks, etc.)
export const toast = (tone: Tone, text: string) => useToastStore.getState().push(tone, text);

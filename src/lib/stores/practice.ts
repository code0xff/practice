import { browser } from '$app/environment';
import { writable } from 'svelte/store';
import type { PracticeSession } from '$lib/data/sessions';

export type SessionProgress = {
  completed: boolean;
  notes: string;
  lastUpdated: string;
};

export type ProgressState = Record<string, SessionProgress>;

const STORAGE_KEY = 'chainlab-progress';

const defaultProgress = (session: PracticeSession): SessionProgress => ({
  completed: false,
  notes: '',
  lastUpdated: new Date().toISOString()
});

const readStorage = (): ProgressState => {
  if (!browser) return {};

  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? (JSON.parse(value) as ProgressState) : {};
  } catch {
    return {};
  }
};

const writeStorage = (state: ProgressState) => {
  if (!browser) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const progressStore = writable<ProgressState>(readStorage());

progressStore.subscribe((state) => {
  writeStorage(state);
});

export const updateProgress = (session: PracticeSession, next: Partial<SessionProgress>) => {
  progressStore.update((state) => {
    const current = state[session.slug] ?? defaultProgress(session);
    const updated = {
      ...current,
      ...next,
      lastUpdated: new Date().toISOString()
    };

    return {
      ...state,
      [session.slug]: updated
    };
  });
};

export const loadProgress = (session: PracticeSession): SessionProgress => {
  if (!browser) return defaultProgress(session);
  const state = readStorage();
  return state[session.slug] ?? defaultProgress(session);
};

export { progressStore };

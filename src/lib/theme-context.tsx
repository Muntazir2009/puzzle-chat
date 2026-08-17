"use client";

import { createContext, useContext, useCallback, useSyncExternalStore, type ReactNode } from "react";

export type AppTheme = "golden" | "default" | "crimson";

interface ThemeContextValue {
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: "golden", setTheme: () => {} });

const STORAGE_KEY = "puzzle-app-theme";

function readStoredTheme(): AppTheme {
  if (typeof window === "undefined") return "golden";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "default" || raw === "crimson") return raw;
  }
  catch {}
  return "golden";
}

let listeners: Array<() => void> = [];

function subscribe(cb: () => void) {
  listeners.push(cb);
  return () => { listeners = listeners.filter((l) => l !== cb); };
}

function getSnapshot(): AppTheme {
  const attr = typeof document !== "undefined"
    ? document.documentElement.getAttribute("data-theme")
    : null;
  if (attr === "default" || attr === "crimson") return attr;
  return "golden";
}

function getServerSnapshot(): AppTheme {
  return "golden";
}

function emitChange() {
  listeners.forEach((l) => l());
}

function applyTheme(t: AppTheme) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", t);
  }
  try { localStorage.setItem(STORAGE_KEY, t); } catch {}
  emitChange();
}

if (typeof window !== "undefined") {
  const stored = readStoredTheme();
  document.documentElement.setAttribute("data-theme", stored);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setTheme = useCallback((t: AppTheme) => {
    applyTheme(t);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}

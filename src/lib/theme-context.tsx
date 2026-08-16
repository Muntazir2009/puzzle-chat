"use client";

import { createContext, useContext, useCallback, useSyncExternalStore, type ReactNode } from "react";

export type AppTheme = "default" | "golden" | "crimson";

interface ThemeContextValue {
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: "default", setTheme: () => {} });

const STORAGE_KEY = "puzzle-app-theme";

function readStoredTheme(): AppTheme {
  if (typeof window === "undefined") return "default";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "golden" || raw === "crimson") return raw;
  } catch {}
  return "default";
}

/* Subscribe to storage events (cross-tab sync) and data-theme mutations. */
let listeners: Array<() => void> = [];

function subscribe(cb: () => void) {
  listeners.push(cb);
  return () => { listeners = listeners.filter((l) => l !== cb); };
}

function getSnapshot(): AppTheme {
  const attr = typeof document !== "undefined"
    ? document.documentElement.getAttribute("data-theme")
    : null;
  if (attr === "golden" || attr === "crimson") return attr;
  return "default";
}

function getServerSnapshot(): AppTheme {
  return "default";
}

function emitChange() {
  listeners.forEach((l) => l());
}

/* Apply theme to DOM and persist */
function applyTheme(t: AppTheme) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", t);
  }
  try { localStorage.setItem(STORAGE_KEY, t); } catch {}
  emitChange();
}

/* Initialise from localStorage on first client render */
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

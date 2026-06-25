import { useSyncExternalStore } from "react";
import type { ThemeMode } from "./types";

// Mirrors settings.theme into synchronous localStorage so the pre-paint init in
// main.tsx can pick the right palette before React (and chrome.storage, which is
// async) load — no flash of the wrong theme when the popup opens.
const THEME_CACHE_KEY = "stash.theme";

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

/**
 * Dark palette, keyed by the real theme-token names. The light values live in
 * app.css (`@theme { --color-*: … }`) and stay the default; these are applied as
 * INLINE custom properties on <html> when dark.
 *
 * Why inline instead of a `.dark { … }` stylesheet rule: Tailwind v4's build
 * optimizer strips rules that only redeclare custom properties (a plain
 * `.dark`/`.dark body`/`.dark .x` block disappears from the bundle), and routing
 * the tokens through backing vars breaks colour-utility generation. Inline styles
 * set at runtime are never touched by that optimizer, override the :root defaults,
 * and cascade to the whole tree — including React portals (tooltips, toasts) on
 * document.body — so every color and shadow utility flips automatically.
 */
const DARK_VARS: Record<string, string> = {
  "--color-bg": "#0E1626",
  "--color-surface": "#18223C",
  "--color-ink": "#F1ECDD",
  "--color-muted": "#A6B0CC",
  "--color-muted-2": "#707B9A",
  "--color-border": "#29344F",
  "--color-border-strong": "#3C4B6E",
  "--color-surface-subtle": "#1D2845",
  "--color-surface-muted": "#141D33",
  "--color-control-hover": "#243254",
  "--color-chip": "#1C2742",

  "--color-accent": "#4F86F2",
  "--color-accent-hi": "#6597F6",
  "--color-accent-lo": "#3D72DE",
  "--color-accent-text": "#93B5FF",
  "--color-accent-soft": "#21305A",

  "--color-success": "#5E92F5",
  "--color-success-soft": "#21305A",
  "--color-success-border": "#36497E",
  "--color-danger": "#E2685C",
  "--color-danger-soft": "#3A201C",
  "--color-danger-border": "#5C332C",
  "--color-danger-border-strong": "#74403A",
  "--color-danger-ink": "#F0A99F",

  // Depth on dark: near-black drops + a whisper-thin top highlight (the blue-tinted
  // light shadows vanish against navy).
  "--shadow-xs": "0 1px 2px rgba(0,0,0,0.35)",
  "--shadow-sm": "0 1px 2px rgba(0,0,0,0.40), 0 1px 4px -1px rgba(0,0,0,0.30)",
  "--shadow-md": "0 2px 4px rgba(0,0,0,0.45), 0 4px 16px -4px rgba(0,0,0,0.55)",
  "--shadow-pop": "0 8px 32px -8px rgba(0,0,0,0.70)",
  "--shadow-raised": "0 1px 1px rgba(0,0,0,0.40), 0 2px 5px -1px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
  "--shadow-raised-hover": "0 2px 4px rgba(0,0,0,0.45), 0 9px 20px -6px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.09)",
  "--shadow-primary": "0 1px 2px rgba(0,0,0,0.50), 0 6px 14px -4px rgba(40,92,204,0.50), inset 0 1px 0 rgba(255,255,255,0.18)",
  "--shadow-primary-hover": "0 2px 3px rgba(0,0,0,0.55), 0 13px 26px -6px rgba(79,134,242,0.60), inset 0 1px 0 rgba(255,255,255,0.22)",
  "--shadow-press": "inset 0 2px 5px rgba(0,0,0,0.50)",

  "--grad-raised": "linear-gradient(180deg, #28344F 0%, #18223C 100%)",
  "--grad-danger-soft": "linear-gradient(180deg, #3A201C 0%, #2E1A17 100%)",
  "--inset-hl": "rgba(255,255,255,0.07)",
  "--inset-hl-soft": "rgba(255,255,255,0.05)",
  "--inset-groove": "rgba(0,0,0,0.40)",
  "--scrim": "rgba(0,0,0,0.60)",
  "--footer-shadow": "0 -6px 16px -8px rgba(0,0,0,0.55)",
};

/** Resolve a preference to a concrete light/dark, consulting the OS for "system". */
export function resolveDark(mode: ThemeMode): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return darkQuery().matches;
}

function setRootScheme(dark: boolean) {
  const el = document.documentElement;
  // The class drives `.dark .paper-bg` (the canvas gradient) and useIsDark().
  el.classList.toggle("dark", dark);
  el.classList.toggle("light", !dark);
  // The palette flips via inline backing vars (see DARK_VARS for the why).
  const style = el.style;
  if (dark) {
    for (const [name, value] of Object.entries(DARK_VARS)) style.setProperty(name, value);
  } else {
    for (const name of Object.keys(DARK_VARS)) style.removeProperty(name);
  }
}

// Only one OS listener at a time; it lives only while we're following "system".
let systemListener: ((e: MediaQueryListEvent) => void) | null = null;

/**
 * Apply a theme preference now: flip the palette, cache the choice, and keep
 * tracking the OS while on "system" so a mid-session dark/light switch follows
 * live. Idempotent — safe to call from both the settings panel and the app shell.
 */
export function applyTheme(mode: ThemeMode): void {
  setRootScheme(resolveDark(mode));
  try {
    localStorage.setItem(THEME_CACHE_KEY, mode);
  } catch {
    /* private mode / storage disabled — the in-memory styles still applied */
  }

  const mq = darkQuery();
  if (systemListener) {
    mq.removeEventListener("change", systemListener);
    systemListener = null;
  }
  if (mode === "system") {
    systemListener = (e) => setRootScheme(e.matches);
    mq.addEventListener("change", systemListener);
  }
}

/** Pre-paint hook for entrypoints: apply the cached preference before render. */
export function initThemeFromCache(): void {
  let mode: ThemeMode = "system";
  try {
    const cached = localStorage.getItem(THEME_CACHE_KEY);
    if (cached === "light" || cached === "dark" || cached === "system") mode = cached;
  } catch {
    /* ignore */
  }
  applyTheme(mode);
}

// ── React binding: components that need the resolved scheme (e.g. the toaster) ──
function subscribeToDark(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

/** Live boolean for the currently-rendered scheme. Re-renders on theme changes. */
export function useIsDark(): boolean {
  return useSyncExternalStore(
    subscribeToDark,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

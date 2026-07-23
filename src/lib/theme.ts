export type ThemeId =
  | "ember"
  | "rose"
  | "slate"
  | "forest"
  | "midnight"
  | "sand"
  | "ocean"
  | "plum"
  | "graphite";

export type ModeId = "light" | "dark";

export const THEMES: Array<{ id: ThemeId; swatch: [string, string, string] }> = [
  { id: "ember", swatch: ["#F99EA1", "#F8C2C2", "#F8F4F4"] },
  { id: "rose", swatch: ["#E7A9C7", "#F1D6E1", "#FBF6F8"] },
  { id: "slate", swatch: ["#475569", "#94A3B8", "#F1F5F9"] },
  { id: "forest", swatch: ["#3F8A5B", "#A7C4A0", "#F0F4EE"] },
  { id: "midnight", swatch: ["#5B7CFA", "#8FA8FF", "#0F1224"] },
  { id: "sand", swatch: ["#C79A5B", "#E7D3B1", "#F7F1E7"] },
  { id: "ocean", swatch: ["#2A7EA1", "#7EB7CE", "#EAF3F6"] },
  { id: "plum", swatch: ["#6B3A6D", "#B58BB6", "#F3EAF3"] },
  { id: "graphite", swatch: ["#1F1F22", "#4A4A50", "#EFEFF1"] },
];

const THEME_KEY = "ember:theme";
const MODE_KEY = "ember:mode";
const THEME_CLASS_PREFIX = "theme-";

export function loadTheme(): { theme: ThemeId; mode: ModeId } {
  if (typeof window === "undefined") return { theme: "ember", mode: "light" };
  const theme = (localStorage.getItem(THEME_KEY) as ThemeId) || "ember";
  const mode = (localStorage.getItem(MODE_KEY) as ModeId) || "light";
  return { theme, mode };
}

export function applyTheme(theme: ThemeId, mode: ModeId) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  // Remove any existing theme-* class
  Array.from(root.classList)
    .filter((c) => c.startsWith(THEME_CLASS_PREFIX))
    .forEach((c) => root.classList.remove(c));
  root.classList.add(`${THEME_CLASS_PREFIX}${theme}`);
  root.classList.toggle("dark", mode === "dark");
  try {
    localStorage.setItem(THEME_KEY, theme);
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

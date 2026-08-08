import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Languages, Palette, Sun, Moon, Check, Bot } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SUPPORTED_LANGS, type LangCode } from "@/i18n";
import { THEMES, applyTheme, loadTheme, type ThemeId, type ModeId } from "@/lib/theme";
import { AI_MODELS, DEFAULT_MODEL_ID, getPreferredModelId, setPreferredModelId } from "@/lib/ai-models";

export function LangThemeSwitcher() {
  const { i18n, t } = useTranslation();
  const [theme, setTheme] = useState<ThemeId>("ember");
  const [mode, setMode] = useState<ModeId>("light");
  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL_ID);

  useEffect(() => {
    const s = loadTheme();
    setTheme(s.theme);
    setMode(s.mode);
    applyTheme(s.theme, s.mode);
    setModelId(getPreferredModelId());
  }, []);

  const setLang = (code: LangCode) => {
    void i18n.changeLanguage(code);
    try {
      localStorage.setItem("ember:lang", code);
    } catch {
      /* ignore */
    }
  };

  const chooseTheme = (id: ThemeId) => {
    setTheme(id);
    applyTheme(id, mode);
  };
  const toggleMode = () => {
    const next: ModeId = mode === "light" ? "dark" : "light";
    setMode(next);
    applyTheme(theme, next);
  };

  return (
    <div className="flex items-center gap-1">
      <Popover>
        <PopoverTrigger asChild>
          <button
            aria-label={t("settings.language")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 hover:bg-card/60"
          >
            <Languages className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-44 rounded-2xl p-2">
          <div className="mb-1 px-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            {t("settings.language")}
          </div>
          {SUPPORTED_LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-accent"
            >
              {l.label}
              {i18n.language?.startsWith(l.code) && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <button
            aria-label={t("settings.theme")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 hover:bg-card/60"
          >
            <Palette className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 rounded-2xl p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {t("settings.theme")}
            </div>
            <button
              onClick={toggleMode}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-[11px]"
            >
              {mode === "light" ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
              {mode === "light" ? t("settings.light") : t("settings.dark")}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-1">
            {THEMES.map((th) => {
              const on = th.id === theme;
              return (
                <button
                  key={th.id}
                  onClick={() => chooseTheme(th.id)}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-accent ${
                    on ? "bg-accent" : ""
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="flex overflow-hidden rounded-md">
                      {th.swatch.map((c, i) => (
                        <span key={i} className="h-4 w-3" style={{ backgroundColor: c }} />
                      ))}
                    </span>
                    <span className="capitalize">{t(`settings.themes.${th.id}`)}</span>
                  </span>
                  {on && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <button
            aria-label={t("settings.aiModel")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 hover:bg-card/60"
          >
            <Bot className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 rounded-2xl p-3">
          <div className="mb-1 px-1 text-[11px] uppercase tracking-widest text-muted-foreground">
            {t("settings.aiModel")}
          </div>
          <p className="mb-2 px-1 text-[11px] text-muted-foreground">{t("settings.aiModelHint")}</p>
          <div className="grid gap-1">
            {AI_MODELS.map((m) => {
              const on = m.id === modelId;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setModelId(m.id);
                    setPreferredModelId(m.id);
                  }}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm hover:bg-accent ${on ? "bg-accent" : ""}`}
                >
                  <span>{m.label}</span>
                  {on && <Check className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

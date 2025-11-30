import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import type {
  TerminalProps,
  TerminalTheme,
  TerminalCursorOptions,
  WindowChromeStyle,
  TerminalWindowChrome,
} from "./types";
import { useTerminalEngine } from "./hooks";
import { MacCloseIcon, MacMinIcon, MacMaxIcon, } from "./assets";
import { PRESET_THEMES, CHROME_STYLES, } from "./themes";
import "./styles.css";

// Defaults
const DEFAULT_PROMPT = "guest@website:$ ";
const DEFAULT_WELCOME_MESSAGE = "";
const DEFAULT_START_PATH = "/";
const DEFAULT_THEME_NAME = "dracula";
const DEFAULT_THEME: TerminalTheme = PRESET_THEMES[DEFAULT_THEME_NAME];
const DEFAULT_CHROME_STYLE: WindowChromeStyle = "mac";
const DEFAULT_TERMINAL_TITLE = "";

// Internal Types
type ResolvedTheme = {
  backgroundColor: string;
  textColor: string;
  promptColor: string;
  fontFamily: string;
  fontSize: string;
  lineHeight: string;
  cursor: Required<TerminalCursorOptions>;
};

type ResolvedChrome =
  | (TerminalWindowChrome & {
      style: Exclude<WindowChromeStyle, "none">;
      buttonColors: NonNullable<TerminalWindowChrome["buttonColors"]>;
      titleBarText: string;
      titleBarTextColor: string;
    })
  | null;


function resolveTheme(themeProp: TerminalProps["theme"]): ResolvedTheme {
  let preset: TerminalTheme = DEFAULT_THEME;

  // If theme is a preset name, use that preset instead
  if (typeof themeProp === "string") {
    preset = PRESET_THEMES[themeProp] ?? DEFAULT_THEME;
  }

  // If theme is an object, treat it as overrides
  const overrides: TerminalTheme =
    typeof themeProp === "object" && themeProp !== null ? themeProp : {};

  // Shallow merge: overrides win, but underlying preset ensures completeness
  const merged: TerminalTheme = { ...preset, ...overrides };

  // Cursor: deep-ish merge so user can override only part of it (e.g. color)
  const baseCursorTheme: TerminalCursorOptions =
    preset.cursor ?? DEFAULT_THEME.cursor!;
  const overrideCursor = overrides.cursor ?? {};

  const mergedCursor: Required<TerminalCursorOptions> = {
    shape: overrideCursor.shape ?? baseCursorTheme.shape!,
    blink: overrideCursor.blink ?? baseCursorTheme.blink!,
    blinkRate: overrideCursor.blinkRate ?? baseCursorTheme.blinkRate!,
    color: overrideCursor.color ?? baseCursorTheme.color!,
  };

  return {
    backgroundColor: merged.backgroundColor!,
    textColor: merged.textColor!,
    promptColor: merged.promptColor!,
    fontFamily: merged.fontFamily!,
    fontSize: merged.fontSize!,
    lineHeight: merged.lineHeight!,
    cursor: mergedCursor,
  };
}

function resolveChrome(
  windowChrome: TerminalProps["windowChrome"]
): ResolvedChrome {
  // Headless / no chrome at all
  if (!windowChrome || windowChrome === "none") {
    return null;
  }

  const style: Exclude<WindowChromeStyle, "none"> =
    typeof windowChrome === "string"
      ? windowChrome
      : windowChrome.style ??
        (DEFAULT_CHROME_STYLE as Exclude<WindowChromeStyle, "none">);

  const base = CHROME_STYLES[style];
  const overrides: Partial<TerminalWindowChrome> =
    typeof windowChrome === "object" ? windowChrome : {};

  const baseButtons = base.buttonColors;
  const overrideButtons = overrides.buttonColors ?? {};

  const buttonColors = {
    close: overrideButtons.close ?? baseButtons.close,
    min: overrideButtons.min ?? baseButtons.min,
    max: overrideButtons.max ?? baseButtons.max,
  };

  const titleBarText =
    overrides.titleBarText !== undefined
      ? overrides.titleBarText
      : DEFAULT_TERMINAL_TITLE;

  const titleBarTextColor =
    overrides.titleBarTextColor !== undefined
      ? overrides.titleBarTextColor
      : base.titleBarTextColor;

  return {
    style,
    buttonColors,
    titleBarText,
    titleBarTextColor,
    cornerRadius: overrides.cornerRadius ?? base.cornerRadius,
  };
}

// Terminal Component
export const Terminal: React.FC<TerminalProps> = ({
  fileStructure: fs,
  startPath = DEFAULT_START_PATH,
  prompt = DEFAULT_PROMPT,
  welcomeMessage = DEFAULT_WELCOME_MESSAGE,
  className,
  theme = DEFAULT_THEME_NAME,
  windowChrome: windowChromeProp = DEFAULT_CHROME_STYLE,
}) => {
  const { state, setInput, submit, complete, navigateHistory } =
    useTerminalEngine(fs, startPath);
    const [showBanner, setShowBanner] = useState(!!welcomeMessage);

  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const themeObj = useMemo(() => resolveTheme(theme), [theme]);
  const cursor = themeObj.cursor;
  const chrome = useMemo(
    () => resolveChrome(windowChromeProp),
    [windowChromeProp]
  );

  // Auto-scroll to bottom when history / completion changes
  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [state.history, state.completion]);

  // CSS variables
  const cssVars = useMemo<React.CSSProperties>(() => {
    const baseChrome = chrome ?? CHROME_STYLES[DEFAULT_CHROME_STYLE];
    const buttons = baseChrome.buttonColors;

    const vars: React.CSSProperties = {
      "--rt-bg": themeObj.backgroundColor,
      "--rt-textColor": themeObj.textColor,
      "--rt-promptColor": themeObj.promptColor,
      "--rt-font": themeObj.fontFamily,
      "--rt-font-size": themeObj.fontSize,
      "--rt-line-height": themeObj.lineHeight,

      "--rt-titlebar-textColor": baseChrome.titleBarTextColor,
      "--rt-corner-radius": `${baseChrome.cornerRadius}px`,
      "--rt-btn-close": buttons.close,
      "--rt-btn-min": buttons.min,
      "--rt-btn-max": buttons.max,

      "--rt-cursor-color": cursor.color,
      "--rt-cursor-rate": `${cursor.blinkRate}ms`,
    } as React.CSSProperties;

    return vars;
  }, [themeObj, chrome, cursor]);

  // Cursor Blink Logic
  const initialTimeoutRef = useRef<number | null>(null);
  const blinkIntervalRef = useRef<number | null>(null);
  const [blinkActive, setBlinkActive] = useState(cursor.blink);

  const clearBlinkTimers = useCallback(() => {
    if (initialTimeoutRef.current !== null) {
      window.clearTimeout(initialTimeoutRef.current);
      initialTimeoutRef.current = null;
    }
    if (blinkIntervalRef.current !== null) {
      window.clearInterval(blinkIntervalRef.current);
      blinkIntervalRef.current = null;
    }
  }, []);

  const startBlinkTimers = useCallback(() => {
    if (!cursor.blink) {
      setBlinkActive(false);
      return;
    }

    setBlinkActive(true);
    clearBlinkTimers();

    initialTimeoutRef.current = window.setTimeout(() => {
      initialTimeoutRef.current = null;
      blinkIntervalRef.current = window.setInterval(() => {
        setBlinkActive((prev) => !prev);
      }, cursor.blinkRate);
    }, cursor.blinkRate);
  }, [cursor.blink, cursor.blinkRate, clearBlinkTimers]);

  useEffect(() => {
    clearBlinkTimers();
    startBlinkTimers();
    return () => clearBlinkTimers();
  }, [cursor.blink, cursor.blinkRate, clearBlinkTimers, startBlinkTimers]);

  const resetBlinkTimer = useCallback(() => {
    if (!cursor.blink) {
      setBlinkActive(false);
      clearBlinkTimers();
      return;
    }
    setBlinkActive(true);
    clearBlinkTimers();
    startBlinkTimers();
  }, [cursor.blink, clearBlinkTimers, startBlinkTimers]);


  const isMac = chrome?.style === "mac";

  return (
    <div className={`rt-wrap ${className ?? ""}`} style={cssVars}>
      <div className={`rt-window ${chrome?.style ?? "none"}`}>
        {chrome && (
          <div className="rt-titlebar">
            <div className="rt-traffic">
              <span className="rt-traffic-dot">
                {isMac && <MacCloseIcon />}
              </span>
              <span className="rt-traffic-dot min">
                {isMac && <MacMinIcon />}
              </span>
              <span className="rt-traffic-dot max">
                {isMac && <MacMaxIcon />}
              </span>
            </div>
            <div className="rt-title">{chrome.titleBarText}</div>
          </div>
        )}

        <div className="rt-body" ref={bodyRef}>
          {showBanner && welcomeMessage ? (
            <div className="rt-banner">{welcomeMessage}</div>
          ) : null}

          {state.history.map((h, i) => (
            <div key={i} className="rt-row">
              {h.in && (
                <div>
                  <span className="rt-prompt">{prompt}</span>
                  {h.in}
                </div>
              )}
              {h.out !== undefined && <div>{h.out}</div>}
            </div>
          ))}

          <div className="rt-row rt-input-row">
            <label htmlFor="rt-input" className="rt-prompt">
              {prompt}
            </label>
            <div className="rt-input-shell">
              <span className="rt-input-ghost" aria-hidden="true">
                {state.input || "\u00a0"}
              </span>
              <span
                className="rt-cursor"
                data-shape={cursor.shape}
                data-blink={cursor.blink && blinkActive ? "1" : "0"}
              />
              <input
                id="rt-input"
                ref={inputRef}
                className="rt-input"
                value={state.input}
                onChange={(e) => {
                  setInput(e.target.value);
                  resetBlinkTimer();
                }}
                onKeyDown={(e) => {
                  resetBlinkTimer();
                  if (e.key === "Enter") {
                    e.preventDefault();
                    // hide welcome banner when user runs `clear`
                    try {
                      const cmd = state.input.trim().split(/\s+/)[0];
                      if (cmd === "clear") setShowBanner(false);
                    } catch (err) {
                      /* ignore */
                    }
                    submit();
                  } else if (e.key === "Tab") {
                    e.preventDefault();
                    complete();
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    navigateHistory("up");
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    navigateHistory("down");
                  }
                }}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
          </div>
            {/* Completion Options Menu */}
            {state.completion && state.completion.options.length > 1 && (
            <div className="rt-row rt-completions-row">
              <div className="rt-completions">
                {state.completion.options.map((opt, idx) => (
                  <span
                    key={opt}
                    className={
                      "rt-completion-option" +
                      (idx === state.completion.index
                        ? " rt-completion-option--active"
                        : "")
                    }
                  >
                    {opt}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

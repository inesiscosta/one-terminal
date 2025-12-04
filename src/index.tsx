import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
  useCallback,
} from "react";
import type {
  TerminalProps,
  TerminalTheme,
  WindowChromeStyle,
  TerminalWindowChrome,
  CursorOptions,
} from "./types";
import { useTerminalEngine } from "./hooks";
import {
  MacCloseIcon,
  MacMinIcon,
  MacMaxIcon,
  WinCloseIcon,
  WinMinIcon,
  WinMaxIcon,
  LinuxCloseIcon,
  LinuxMinIcon,
  LinuxMaxIcon,
} from "./assets";
import { PRESET_THEMES, CHROME_STYLES } from "./themes";
import "./styles.css";

// Defaults
const DEFAULT_PROMPT = "guest@website:$ ";
const DEFAULT_WELCOME_MESSAGE = "";
const DEFAULT_START_PATH = "/";
const DEFAULT_THEME: TerminalTheme = PRESET_THEMES["dracula"];
const DEFAULT_CHROME_STYLE: Exclude<WindowChromeStyle, "none"> = "mac";
const DEFAULT_WINDOW_CHROME: TerminalWindowChrome = CHROME_STYLES[DEFAULT_CHROME_STYLE];

// TODO: Add more theme validation warnings
function resolveTheme(themeProp: TerminalProps["theme"]): TerminalTheme {
  let preset: TerminalTheme = DEFAULT_THEME;
  let overrides: Partial<TerminalTheme> = {};

  // Overrides on a preset theme
  if (Array.isArray(themeProp)) {
    const [presetName, themeOverrides] = themeProp;

    if (typeof presetName === "string") {
      if (presetName in PRESET_THEMES) {
        preset = PRESET_THEMES[presetName];
      } else {
        console.warn(`Terminal: unrecognized theme preset name "${presetName}", falling back to default theme.`);
      }
    } else if (presetName != null) {
      console.warn(`Terminal: invalid theme preset name in array, expected string but got ${typeof presetName}.`);
    }

    if (typeof themeOverrides === "object") {
      overrides = themeOverrides as Partial<TerminalTheme>;
    } else if (themeOverrides != null) {
      console.warn(`Terminal: invalid theme overrides in array, expected object but got ${typeof themeOverrides}.`);
    }
  }

  // Preset theme
  else if (typeof themeProp === "string") {
    if (themeProp in PRESET_THEMES) {
      preset = PRESET_THEMES[themeProp];
    } else {
      console.warn(`Terminal: unrecognized theme preset name "${themeProp}", falling back to default theme.`);
    }
  }

  // Full custom theme or default theme overrides
  else if (typeof themeProp === "object" && themeProp !== null) {
    overrides = { ...(themeProp as TerminalTheme) };
  }

  // Invalid theme prop
  else if (themeProp != null) {
    console.warn(`Terminal: invalid theme prop, expected string, object, or [string, object] but got ${typeof themeProp}.`);
  }

  const mergedCursor: CursorOptions = {
    ...(preset.cursor as CursorOptions),
    ...(overrides.cursor as Partial<CursorOptions> | undefined),
  };

  const merged: TerminalTheme = {
    ...preset,
    ...overrides,
    cursor: mergedCursor,
  };

  return {
    backgroundColor: merged.backgroundColor!,
    textColor: merged.textColor!,
    promptColor: merged.promptColor!,
    fontFamily: merged.fontFamily!,
    fontSize: merged.fontSize!,
    lineHeight: merged.lineHeight!,
    cursor: merged.cursor!,
  };
}

function resolveChrome(windowChromeProp: TerminalProps["windowChrome"]): TerminalWindowChrome | null {
  // Headless mode: no windowChrome
  if (windowChromeProp === "none") {
    return null;
  }

  let preset: TerminalWindowChrome = DEFAULT_WINDOW_CHROME;
  let overrides: Partial<TerminalWindowChrome> = {};

  if (Array.isArray(windowChromeProp)) {
    const [presetName, windowOverrides] = windowChromeProp;
    // Overrides on a preset style
    if (typeof presetName === "string") {
      if (presetName in CHROME_STYLES) {
        preset = CHROME_STYLES[presetName];
      } else {
        console.warn( `Terminal: unrecognized window chrome preset name "${presetName}", falling back to default window chrome style.`);
      }
    } else if (presetName != null) {
      console.warn(`Terminal: invalid window chrome preset name in array, expected string but got ${typeof presetName}.`);
    }

    if (typeof windowOverrides === "object") {
      overrides = windowOverrides as Partial<TerminalWindowChrome>;
    } else if (windowOverrides != null) {
      console.warn( `Terminal: invalid window chrome overrides in array, expected object but got ${typeof windowOverrides}.`);
    }
  }

  // Preset style
  else if (typeof windowChromeProp === "string") {
    if (windowChromeProp in CHROME_STYLES) {
      preset = CHROME_STYLES[windowChromeProp];
    } else {
      console.warn(`Terminal: unrecognised window chrome style "${windowChromeProp}", falling back to "${DEFAULT_CHROME_STYLE}".`);
    }
  }

  // Full custom window chrome or default style overrides
  else if (typeof windowChromeProp === "object" && windowChromeProp !== null) {
    overrides = { ...(windowChromeProp as TerminalWindowChrome) };
  }

  // Invalid windowChrome prop
  else if (windowChromeProp != null) {
    console.warn(`Terminal: invalid windowChrome prop, expected "none", string, or [string, object] but got ${typeof windowChromeProp}.`);
  }

  const merged: TerminalWindowChrome = { ...preset, ...overrides };

  return {
    style: merged.style,
    cornerRadius: merged.cornerRadius!,
    titleBarText: merged.titleBarText!,
    titleBarTextColor: merged.titleBarTextColor!,
    buttonColors: {
      close: merged.buttonColors?.close,
      min: merged.buttonColors?.min,
      max: merged.buttonColors?.max,
      iconColor: merged.buttonColors?.iconColor,
    },
  };
}

// Terminal Component
export const Terminal: React.FC<Partial<TerminalProps>> = ({
  fileStructure: fs,
  startPath = DEFAULT_START_PATH,
  welcomeMessage = DEFAULT_WELCOME_MESSAGE,
  prompt = DEFAULT_PROMPT,
  windowChrome,
  theme,
  extraCommands,
  className,
}) => {
  const resolvedWindowChrome = useMemo(() => resolveChrome(windowChrome), [windowChrome]);
  const resolvedTheme = useMemo(() => resolveTheme(theme), [theme]);
  const [showBanner, setShowBanner] = useState(!!welcomeMessage);

  const { state, setInput, submit, complete, navigateHistory, interrupt } =
    useTerminalEngine(fs, startPath, extraCommands);

  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const shellRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const ghostRef = useRef<HTMLSpanElement | null>(null);

  const [caretIndex, setCaretIndex] = useState(0);
  const [caretBox, setCaretBox] = useState({ left: 0, top: 0, width: 8, height: 16 });
  const [isTyping, setIsTyping] = useState(false);
  const typingTimerRef = useRef<number | null>(null);

  const markTyping = () => {
    setIsTyping(true);
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    const delay = Math.max(250, (state as any).cursor?.blinkRate ?? 500);
    typingTimerRef.current = window.setTimeout(() => {
      setIsTyping(false);
      typingTimerRef.current = null;
    }, delay);
  };

  const syncCaretFromInput = () => {
    const el = inputRef.current;
    if (!el) return;
    const pos = typeof el.selectionStart === "number" ? el.selectionStart : el.value.length;
    setCaretIndex(Math.min(pos, el.value.length));
  };

  const measureTextWidth = (text: string) => {
    const m = measureRef.current;
    if (!m) return 0;
    m.textContent = text || "\u00A0";
    return m.getBoundingClientRect().width;
  };

  useLayoutEffect(() => {
    const measure = () => {
      const shell = shellRef.current;
      const ghost = ghostRef.current;
      if (!shell || !ghost) {
        const w = measureTextWidth(state.input?.slice(0, caretIndex) ?? "");
        setCaretBox((b) => ({ ...b, left: Math.max(0, w) }));
        return;
      }
      const marker = ghost.querySelector(`[data-pos="${caretIndex}"]`) as HTMLElement | null;
      if (!marker) {
        const w = measureTextWidth(state.input?.slice(0, caretIndex) ?? "");
        setCaretBox((b) => ({ ...b, left: Math.max(0, w) }));
        return;
      }
      const mr = marker.getBoundingClientRect();
      const sr = shell.getBoundingClientRect();
      setCaretBox({
        left: Math.max(0, mr.left - sr.left),
        top: Math.max(0, mr.top - sr.top),
        width: Math.max(1, mr.width),
        height: Math.max(1, mr.height),
      });
    };

    const id = window.requestAnimationFrame(measure);
    const onResize = () => window.requestAnimationFrame(measure);
    window.addEventListener("resize", onResize);
    const fonts = (document as any).fonts;
    if (fonts?.ready?.then) fonts.ready.then(() => window.requestAnimationFrame(measure)).catch(() => {});
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("resize", onResize);
    };
  }, [state.input, caretIndex, /* font changes */]);

  const indexFromX = (x: number) => {
    const m = measureRef.current;
    const text = state.input || "";
    if (!m || !text) return 0;
    m.textContent = text;
    const full = m.getBoundingClientRect().width;
    if (x >= full) return text.length;
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      m.textContent = text.slice(0, mid + 1) || "\u00A0";
      const w = m.getBoundingClientRect().width;
      if (w <= x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  const onShellMouseDown = (e: React.MouseEvent) => {
    const input = inputRef.current;
    const shell = shellRef.current;
    if (!input || !shell) {
      inputRef.current?.focus();
      return;
    }
    e.preventDefault();
    const target = e.target as Element;
    let pos: number | null = null;
    const charEl = target.closest("[data-pos]");
    if (charEl instanceof HTMLElement) {
      const v = charEl.getAttribute("data-pos");
      if (v != null) pos = parseInt(v, 10);
    }
    if (pos === null) {
      const rect = shell.getBoundingClientRect();
      pos = indexFromX((e as any).clientX - rect.left);
    }
    input.focus();
    input.setSelectionRange(pos, pos);
    setCaretIndex(pos);
  };

  useEffect(() => {
    const handler = () => syncCaretFromInput();
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, []);

  const renderGhost = () => {
    const text = state.input || "";
    const nodes: React.ReactNode[] = [];
    for (let i = 0; i < text.length; i++) {
      nodes.push(
        <span key={i} data-pos={i} className="rt-ghost-char" aria-hidden>
          {text[i]}
        </span>
      );
    }
    nodes.push(
      <span key="__end" data-pos={text.length} className="rt-ghost-char" aria-hidden>
        {"\u00A0"}
      </span>
    );
    return nodes;
  };

  const focusInput = () => inputRef.current?.focus();

  const themeObj = useMemo(() => resolveTheme(theme), [theme]);
  const cursor = themeObj.cursor;
  const chrome = useMemo(
    () => resolveChrome(windowChrome),
    [windowChrome]
  );

  // Auto-scroll to bottom when history / completion changes
  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [state.history, state.completion]);

  // CSS Variables
  const cssVariables = useMemo<React.CSSProperties>(() => {
    const vars: React.CSSProperties = {
      "--rt-background": resolvedWindowChrome ? resolvedTheme.backgroundColor : "transparent",
      "--rt-textColor": resolvedTheme.textColor,
      "--rt-promptColor": resolvedTheme.promptColor,
      "--rt-font": resolvedTheme.fontFamily,
      "--rt-font-size": resolvedTheme.fontSize,
      "--rt-line-height": resolvedTheme.lineHeight,
      "--rt-corner-radius": `${resolvedWindowChrome?.cornerRadius}px`,
      "--rt-titlebar-textColor": resolvedWindowChrome?.titleBarTextColor,
      "--rt-btn-close": resolvedWindowChrome?.buttonColors.close,
      "--rt-btn-min": resolvedWindowChrome?.buttonColors.min,
      "--rt-btn-max": resolvedWindowChrome?.buttonColors.max,
      "--rt-cursor-color": resolvedTheme.cursor.color,
      "--rt-cursor-rate": `${resolvedTheme.cursor.blinkRate}ms`,
      "--rt-icon-color": resolvedWindowChrome?.buttonColors.iconColor,
    } as React.CSSProperties;

    return vars;
  }, [resolvedWindowChrome, resolvedTheme]);

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

  // caret visual calculations
  const caretShape = cursor.shape;
  // blink applies only to line or block and only when not typing and blinkActive
  const caretShouldBlink =
    cursor.blink &&
    (caretShape === "line" || caretShape === "block") &&
    !isTyping &&
    blinkActive;

  // Decide z-order only:
  // - when blockSolid is true, caret should appear in front of text (higher z)
  // - when blockSolid is false, caret should appear behind the ghost text (lower z)
  const blockSolid = !!(cursor as any).blockSolid;
  const caretZIndex = blockSolid ? 6 : 2;

  const underscoreThickness = 2;
  const underscoreTop = Math.round(
    caretBox.top + caretBox.height - Math.max(1, underscoreThickness) + 1
  );

  const caretInlineStyle: React.CSSProperties = {
    left: `${caretBox.left}px`,
    top: `${caretShape === "underline" ? underscoreTop : caretBox.top}px`,
    width: caretShape === "line" ? 2 : `${caretBox.width}px`,
    height:
      caretShape === "line"
        ? `${caretBox.height}px`
        : caretShape === "block"
        ? `${caretBox.height}px`
        : `${underscoreThickness}px`,

    // Visual fill:
    // - Always render the block as filled. We control whether it covers text using z-index.
    background:
      caretShape === "line" ? "var(--rt-cursor-color)" : "var(--rt-cursor-color)",

    // Underline uses borderBottom
    borderBottom:
      caretShape === "underline"
        ? `${underscoreThickness}px solid var(--rt-cursor-color)`
        : undefined,

    // animation: use the overlay blink keyframes defined in styles.css
    animationName: caretShouldBlink ? "rt-overlay-caret-blink" : "none",
    animationDuration: `${cursor.blinkRate}ms`,
    animationPlayState: caretShouldBlink ? "running" : "paused",

    zIndex: caretZIndex,
    position: "absolute",
  };

  return (
    <div className={`${className ?? ""}`} style={cssVariables}>
      <div className={`rt-window ${resolvedWindowChrome ? resolvedWindowChrome.style : ""}`}>
        {resolvedWindowChrome && (
          <div className={`rt-titlebar ${resolvedWindowChrome.style}`}>
            {resolvedWindowChrome.style === "mac" && (
              <>
                <div className="rt-window-controls mac" aria-hidden="true">
                  <span className="rt-window-control close mac" role="presentation" title="Close">
                    <MacCloseIcon />
                  </span>
                  <span className="rt-window-control min mac" role="presentation" title="Minimise">
                    <MacMinIcon />
                  </span>
                  <span className="rt-window-control max mac" role="presentation" title="Zoom">
                    <MacMaxIcon />
                  </span>
                </div>
                <div className="rt-title mac">
                  {resolvedWindowChrome.titleBarText}
                </div>
              </>
            )}

            {resolvedWindowChrome.style === "windows" && (
              <>
                <div className="rt-title windows">
                  {resolvedWindowChrome.titleBarText}
                </div>
                <div className="rt-window-controls windows" aria-hidden="true">
                  <span className="rt-window-control min windows" role="presentation" title="Minimise">
                    <WinMinIcon />
                  </span>
                  <span className="rt-window-control max windows" role="presentation" title="Maximise">
                    <WinMaxIcon />
                  </span>
                  <span className="rt-window-control close windows" role="presentation" title="Close">
                    <WinCloseIcon />
                  </span>
                </div>
              </>
            )}

            {resolvedWindowChrome.style === "linux" && (
              <>
                <div className="rt-title linux">
                  {resolvedWindowChrome.titleBarText}
                </div>
                <div className="rt-window-controls linux" aria-hidden="true">
                  <span className="rt-window-control min linux" role="presentation" title="Minimise">
                    <LinuxMinIcon />
                  </span>
                  <span className="rt-window-control max linux" role="presentation" title="Maximise">
                    <LinuxMaxIcon />
                  </span>
                  <span className="rt-window-control close linux" role="presentation" title="Close">
                    <LinuxCloseIcon />
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        <div className="rt-body" ref={bodyRef}>
          {showBanner && welcomeMessage ? (
            <div className="rt-welcome-message">{welcomeMessage}</div>
          ) : null}

          {state.history.map(({ in: input, out }, index) => (
            <div key={index} className="rt-row">
              <div>
                <span className="rt-prompt">{prompt}</span>
                {input}
              </div>
              {out && <div>{out}</div>}
            </div>
          ))}

          <div className="rt-row rt-input-row" onMouseDown={focusInput}>
            <label htmlFor="rt-input" className="rt-prompt">
              {prompt}
            </label>
            <div className="rt-input-shell" ref={shellRef} onMouseDown={onShellMouseDown} style={{ position: "relative" }}>
              <span className="rt-input-ghost" ref={ghostRef} aria-hidden>
                {renderGhost()}
              </span>
              <span className="rt-measure" ref={measureRef} aria-hidden style={{ position: "absolute", visibility: "hidden", whiteSpace: "pre" }} />

              <input
                id="rt-input"
                ref={inputRef}
                className="rt-input"
                value={state.input}
                onChange={(e) => {
                  setInput(e.target.value);
                  markTyping();
                  const pos = typeof e.target.selectionStart === "number" ? e.target.selectionStart : e.target.value.length;
                  setCaretIndex(pos);
                  resetBlinkTimer();
                }}
                onKeyDown={(e) => {
                  markTyping();
                  resetBlinkTimer();

                  if (e.key === "Enter") {
                    e.preventDefault();
                    try {
                      const cmd = state.input.trim().split(/\s+/)[0];
                      if (cmd === "clear") setShowBanner(false);
                    } catch (err) {}
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
                onKeyUp={syncCaretFromInput}
                onClick={() => {
                  markTyping();
                  syncCaretFromInput();
                }}
                onSelect={() => {
                  markTyping();
                  syncCaretFromInput();
                }}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                style={{ color: "transparent", caretColor: "transparent", background: "transparent", position: "relative", zIndex: 3 }}
              />

              <span className={`rt-overlay-caret rt-overlay-caret-${caretShape}`} aria-hidden style={caretInlineStyle} />
            </div>
          </div>

          {state.completion && state.completion.options.length > 1 && (
            <div className="rt-row rt-completion-options">
              {state.completion.options.map((option, index) => (
                <span key={index} className="rt-completion-option">
                  {option}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

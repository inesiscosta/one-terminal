import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  useLayoutEffect,
} from "react";
import type {
  TerminalProps,
  TerminalTheme,
  TerminalCursorOptions,
  WindowChromeStyle,
  TerminalWindowChrome,
} from "./types";
import { useTerminalEngine } from "./hooks";
import { MacOsTrafficLight } from "./assets";
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
      macButtonsInnerColor?: string;
    })
  | null;


function resolveTheme(themeProp: TerminalProps["theme"]): ResolvedTheme {
	let preset: TerminalTheme = DEFAULT_THEME;
	let overrides: TerminalTheme = {};

	// Array shorthand: ["monokai", { promptColor: '...' }]
	if (Array.isArray(themeProp)) {
		const [presetName, maybeOverrides] = themeProp;
		if (typeof presetName === "string") {
			preset = PRESET_THEMES[presetName] ?? DEFAULT_THEME;
		}
		overrides = (maybeOverrides && typeof maybeOverrides === "object") ? (maybeOverrides as TerminalTheme) : {};
	} else if (typeof themeProp === "string") {
		// simple preset name
		preset = PRESET_THEMES[themeProp] ?? DEFAULT_THEME;
		overrides = {};
	} else if (typeof themeProp === "object" && themeProp !== null) {
		// Could be:
		//  - a plain overrides object
		//  - the result of spreading a string: {..."monokai", theme: { ... } }
		const obj = themeProp as Record<string, any>;

		// detect numeric keys produced by spreading a string
		const numericKeys = Object.keys(obj).filter((k) => /^\d+$/.test(k));
		if (numericKeys.length) {
			// reconstruct candidate preset name from ordered numeric keys
			numericKeys.sort((a, b) => Number(a) - Number(b));
			const candidate = numericKeys.map((k) => String(obj[k])).join("");
			if (typeof candidate === "string" && PRESET_THEMES[candidate] && numericKeys.length === candidate.length) {
				preset = PRESET_THEMES[candidate] ?? DEFAULT_THEME;
				// prefer nested `theme` property as overrides if present
				if (obj.theme && typeof obj.theme === "object") {
					overrides = { ...(obj.theme as TerminalTheme) };
				} else {
					// otherwise copy non-numeric props (excluding any accidental sentinel keys)
					overrides = { ...obj } as TerminalTheme;
					for (const k of numericKeys) delete (overrides as any)[k];
					delete (overrides as any).theme;
					delete (overrides as any).preset;
					delete (overrides as any).base;
				}
			} else {
				// not a recognized spread-string; treat as normal overrides
				overrides = { ...obj } as TerminalTheme;
			}
		} else {
			// Normal overrides object; also accept optional 'preset'/'base' markers
			overrides = { ...obj } as TerminalTheme;
			const maybePreset = (overrides as any).preset ?? (overrides as any).base;
			if (typeof maybePreset === "string") {
				preset = PRESET_THEMES[maybePreset] ?? DEFAULT_THEME;
				// remove marker so it doesn't become part of merged theme
				delete (overrides as any).preset;
				delete (overrides as any).base;
			}
		}
	} else {
		overrides = {};
	}

	// Shallow merge: overrides win, preset provides defaults
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
		solidBlock: overrideCursor.solidBlock ?? baseCursorTheme.solidBlock!,
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
    macButtonsInnerColor: overrides.macButtonsInnerColor ?? base.macButtonsInnerColor,
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
  extraCommands,
}) => {
  const { state, setInput, submit, complete, navigateHistory } =
    useTerminalEngine(fs, startPath, extraCommands);
  const [showBanner, setShowBanner] = useState(!!welcomeMessage);

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
      // make background transparent in headless mode
      "--rt-bg": chrome ? themeObj.backgroundColor : "transparent",

      "--rt-textColor": themeObj.textColor,
      "--rt-promptColor": themeObj.promptColor,
      "--rt-font": themeObj.fontFamily,
      "--rt-font-size": themeObj.fontSize,
      "--rt-line-height": themeObj.lineHeight,
      "--rt-corner-radius": `${baseChrome.cornerRadius}px`,
      "--rt-titlebar-textColor": baseChrome.titleBarTextColor,
      "--rt-btn-close": buttons.close,
      "--rt-btn-min": buttons.min,
      "--rt-btn-max": buttons.max,
      "--rt-cursor-color": cursor.color,
      "--rt-cursor-rate": `${cursor.blinkRate}ms`,
      "--rt-mac-buttons-inner-color": chrome?.macButtonsInnerColor ?? baseChrome.macButtonsInnerColor,
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
    <div className={`rt-wrap ${className ?? ""}`} style={cssVars}>
      {/* don't add a "none" class and skip titlebar when headless (chrome === null) */}
      <div className={`rt-window ${chrome ? chrome.style : ""}`}>
        {chrome ? (
          <div className="rt-titlebar">
            {chrome.style === "mac" ? (
              <MacOsTrafficLight />
            ) : (
              <div className="rt-traffic">
                <span className="rt-traffic-dot close" />
                <span className="rt-traffic-dot min" />
                <span className="rt-traffic-dot max" />
              </div>
            )}
            <div className="rt-title">{chrome.titleBarText}</div>
          </div>
        ) : null}
        <div className="rt-body" ref={bodyRef}>
          {showBanner && welcomeMessage ? (
            <div className="rt-welcome-message">{welcomeMessage}</div>
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

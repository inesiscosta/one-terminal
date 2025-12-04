import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
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

  const { state, setInput, submit, complete, navigateHistory, interrupt } =
    useTerminalEngine(fs, startPath, extraCommands);

  const [showBanner, setShowBanner] = useState(!!welcomeMessage);
  const [typing, setTyping] = useState(false);
  const [cursorOffset, setCursorOffset] = useState(0);

  const realCaretRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(0);

  const syncCaretPosition = () => {
    const input = inputRef.current;
    const measurer = realCaretRef.current;
    if (!input || !measurer) return;

    const value = input.value;
    const caretIndex = input.selectionStart ?? value.length;

    if (caretIndex === 0) {
      measurer.textContent = "";
      setCursorOffset(0);
      return;
    }

    const textBeforeCursor = value.slice(0, caretIndex);

    measurer.textContent = textBeforeCursor || "\u00A0";

    const { width } = measurer.getBoundingClientRect();
    setCursorOffset(width);
  };

  const markTyping = () => {
    setTyping(true);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => setTyping(false),
      resolvedTheme.cursor.blinkRate
    );
  };

  useEffect(() => {
    return () => {
      clearTimeout(timer.current);
    };
  }, []);

  // Auto-scroll on new output
  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [state.history, state.completion]);

  // Handle focus on terminal body click
  const handleBodyFocus: React.FocusEventHandler<HTMLDivElement> = () => {
    inputRef.current.focus();
    requestAnimationFrame(syncCaretPosition);
  };

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
      "--rt-cursor-left": `${cursorOffset}px`,
      "--rt-icon-color": resolvedWindowChrome?.buttonColors.iconColor,
    } as React.CSSProperties;

    return vars;
  }, [resolvedWindowChrome, resolvedTheme, cursorOffset]);

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

        <div className="rt-body" ref={bodyRef} tabIndex={-1} onFocus={handleBodyFocus}>
          {showBanner && (
            <div className="rt-welcome-message">{welcomeMessage}</div>
          )}

          {state.history.map(({ in: input, out }, index) => (
            <div key={index} className="rt-row">
              <div>
                <span className="rt-prompt">{prompt}</span>
                {input}
              </div>
              {out && <div>{out}</div>}
            </div>
          ))}

          <div className="rt-row rt-input-row">
            <span className="rt-prompt">{prompt}</span>
            <span className="rt-input-container">
              <span className="rt-input-text">{state.input || '\u00A0'}</span>
              <span ref={realCaretRef} className="rt-real-caret" aria-hidden />
              <span className={`rt-cursor rt-cursor-${resolvedTheme.cursor.shape}${resolvedTheme.cursor.shape === 'block' && !resolvedTheme.cursor.solidBlock ? ' transparent' : ''}${!typing && resolvedTheme.cursor.blink ? ' rt-cursor-blink' : ''}`} aria-hidden />
              <input
                ref={inputRef}
                className="rt-input"
                value={state.input}
                onChange={(e) => {
                  setInput(e.target.value);
                  markTyping();
                  requestAnimationFrame(syncCaretPosition);
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                  const input = inputRef.current;
                  input.focus();
                  const end = input.value.length;
                  input.selectionStart = end;
                  input.selectionEnd = end;
                  requestAnimationFrame(syncCaretPosition);
                }}
                onKeyDown={(event) => {
                  markTyping();
                  // Ctrl+C
                  if (event.key === "c" && event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
                    event.preventDefault();
                    interrupt();
                    requestAnimationFrame(syncCaretPosition);
                    return;
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    if (state.input.trim().split(/\s+/)[0] === "clear") setShowBanner(false);
                    submit();
                    requestAnimationFrame(syncCaretPosition);
                  } else if (event.key === "Tab") {
                    event.preventDefault();
                    complete();
                    requestAnimationFrame(syncCaretPosition);
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    navigateHistory("up");
                    requestAnimationFrame(syncCaretPosition);
                  } else if (event.key === "ArrowDown") {
                    event.preventDefault();
                    navigateHistory("down");
                    requestAnimationFrame(syncCaretPosition);
                  } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                    requestAnimationFrame(syncCaretPosition);
                  }
                }}
                onKeyUp={() => requestAnimationFrame(syncCaretPosition)}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </span>
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

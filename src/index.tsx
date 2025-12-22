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
  DirectoryNode,
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
export * from "./types";
import { PRESET_THEMES, CHROME_STYLES } from "./themes";

type ResolvedTerminalTheme = TerminalTheme & { cursor: CursorOptions };

// Defaults
const DEFAULT_PROMPT = "guest@{cwd}:$ ";
const DEFAULT_WELCOME_MESSAGE = "";
const DEFAULT_START_PATH = "/";
const DEFAULT_THEME: TerminalTheme = PRESET_THEMES["dracula"];
const DEFAULT_CHROME_STYLE: Exclude<WindowChromeStyle, "none"> = "mac";
const DEFAULT_WINDOW_CHROME: TerminalWindowChrome = CHROME_STYLES[DEFAULT_CHROME_STYLE];
const DEFAULT_FILE_STRUCTURE: DirectoryNode = { kind: "directory", entries: {} };

function resolveTheme(themeProp: TerminalProps["theme"]): ResolvedTerminalTheme {
  let preset: TerminalTheme = DEFAULT_THEME;
  let overrides: Partial<TerminalTheme> = {};

  if (Array.isArray(themeProp)) {
    const [presetName, themeOverrides] = themeProp;

    if (typeof presetName === "string") {
      if (presetName in PRESET_THEMES) {
        preset = PRESET_THEMES[presetName as keyof typeof PRESET_THEMES];
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
  } else if (typeof themeProp === "string") {
    if (themeProp in PRESET_THEMES) {
      preset = PRESET_THEMES[themeProp as keyof typeof PRESET_THEMES];
    } else {
      console.warn(`Terminal: unrecognized theme preset name "${themeProp}", falling back to default theme.`);
    }
  } else if (typeof themeProp === "object" && themeProp !== null) {
    overrides = { ...(themeProp as TerminalTheme) };
  } else if (themeProp != null) {
    console.warn(`Terminal: invalid theme prop, expected string, object, or [string, object] but got ${typeof themeProp}.`);
  }

  const mergedCursor: CursorOptions = {
    ...(preset.cursor as CursorOptions),
    ...(overrides.cursor as Partial<CursorOptions> | undefined),
  };

  return {
    ...preset,
    ...overrides,
    backgroundColor: overrides.backgroundColor ?? preset.backgroundColor!,
    textColor: overrides.textColor ?? preset.textColor!,
    promptColor: overrides.promptColor ?? preset.promptColor!,
    fontFamily: overrides.fontFamily ?? preset.fontFamily!,
    fontSize: overrides.fontSize ?? preset.fontSize!,
    lineHeight: overrides.lineHeight ?? preset.lineHeight!,
    cursor: mergedCursor!,
  } as ResolvedTerminalTheme;
}

function resolveChrome(windowChromeProp: TerminalProps["windowChrome"]): TerminalWindowChrome | null {
  if (windowChromeProp === "none") return null;

  let preset: TerminalWindowChrome = DEFAULT_WINDOW_CHROME;
  let overrides: Partial<TerminalWindowChrome> = {};

  if (Array.isArray(windowChromeProp)) {
    const [presetName, windowOverrides] = windowChromeProp;
    if (typeof presetName === "string") {
      if (presetName in CHROME_STYLES) {
        // @ts-ignore
        preset = CHROME_STYLES[presetName];
      } else {
        console.warn(`Terminal: unrecognized window chrome preset name "${presetName}", falling back to default window chrome style.`);
      }
    } else if (presetName != null) {
      console.warn(`Terminal: invalid window chrome preset name in array, expected string but got ${typeof presetName}.`);
    }

    if (typeof windowOverrides === "object") {
      overrides = windowOverrides as Partial<TerminalWindowChrome>;
    } else if (windowOverrides != null) {
      console.warn(`Terminal: invalid window chrome overrides in array, expected object but got ${typeof windowOverrides}.`);
    }
  } else if (typeof windowChromeProp === "string") {
    if (windowChromeProp in CHROME_STYLES) {
      preset = CHROME_STYLES[windowChromeProp];
    } else {
      console.warn(`Terminal: unrecognised window chrome style "${windowChromeProp}", falling back to "${DEFAULT_CHROME_STYLE}".`);
    }
  } else if (typeof windowChromeProp === "object" && windowChromeProp !== null) {
    overrides = { ...(windowChromeProp as TerminalWindowChrome) };
  } else if (windowChromeProp != null) {
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

function makeWindowStyle(
  theme: TerminalTheme,
  chrome: TerminalWindowChrome | null,
): React.CSSProperties {
  return {
    backgroundColor: chrome ? theme.backgroundColor : "transparent",
    borderRadius: chrome ? chrome.cornerRadius : undefined,
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    color: theme.textColor,
    lineHeight: theme.lineHeight,
    clipPath: chrome ? `inset(0 round ${chrome.cornerRadius}px)` : undefined,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };
}

function makeTitlebarStyle(chrome: TerminalWindowChrome): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    position: "relative",
    flexShrink: 0,
  };

  if (chrome.style === "mac") return { ...base, padding: "12px" };
  if (chrome.style === "windows") {
    return {
      ...base,
      height: 32,
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.181)",
    };
  }
  return { ...base, justifyContent: "flex-end" };
}

function makeTitleStyle(chrome: TerminalWindowChrome): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: 13,
    color: chrome.titleBarTextColor,
    pointerEvents: "none",
    userSelect: "none",
  };

  if (chrome.style === "mac" || chrome.style === "linux") {
    return {
      ...base,
      position: "absolute",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
    };
  }
  return { ...base, marginLeft: 10 };
}

function makeWindowControlsContainerStyle(chrome: TerminalWindowChrome): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: chrome.buttonColors.iconColor,
    height: "100%",
  };

  if (chrome.style === "mac") return { ...base, gap: 8 };
  return base;
}

type ControlKind = "close" | "min" | "max";
type HoverState = ControlKind | "mac-container" | null;

function makeMacControlStyle(
  chrome: TerminalWindowChrome,
  kind: ControlKind,
): React.CSSProperties {
  const background =
    kind === "close"
      ? chrome.buttonColors.close
      : kind === "min"
        ? chrome.buttonColors.min
        : chrome.buttonColors.max;

  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 11,
    height: 11,
    borderRadius: "50%",
    padding: 0,
    background: background,
  };
}

function makeWindowsControlStyle(
  chrome: TerminalWindowChrome,
  kind: ControlKind,
  hovered: boolean,
): React.CSSProperties {
  let background = "transparent";
  if (hovered) {
    if (kind === "close") background = chrome.buttonColors.close!;
    else if (kind === "min") background = chrome.buttonColors.min!;
    else background = chrome.buttonColors.max!;
  }

  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 46,
    height: "100%",
    background,
    transition: "background 0.1s",
  };
}

function makeLinuxControlOuterStyle(): React.CSSProperties {
  return {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    borderRadius: "50%",
  };
}

function makeLinuxControlInnerCircleStyle(
  chrome: TerminalWindowChrome,
  kind: ControlKind,
  hovered: boolean,
): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    width: "70%",
    height: "70%",
    borderRadius: "50%",
    zIndex: 1,
    background: "transparent",
  };

  if (!hovered) return base;

  const background =
    kind === "close"
      ? chrome.buttonColors.close
      : kind === "min"
        ? chrome.buttonColors.min
        : chrome.buttonColors.max;

  return { ...base, background };
}

const styles = {
  body: { padding: 10, overflowY: "auto", flex: 1, display: "flex", flexDirection: "column" } as React.CSSProperties,
  row: { flexShrink: 0 } as React.CSSProperties,
  historyLine: { whiteSpace: "pre-wrap", wordBreak: "break-all" } as React.CSSProperties,
  inputRow: {
    position: "relative",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  } as React.CSSProperties,
  inputContainer: {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    flex: 1,
  } as React.CSSProperties,
  inputText: {
    whiteSpace: "pre",
    display: "inline-block",
    lineHeight: 1,
    font: "inherit",
    minHeight: '1em',
  } as React.CSSProperties,
  hiddenInput: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    border: "none",
    outline: "none",
    color: "transparent",
    background: "transparent",
    caretColor: "transparent",
    font: "inherit",
    resize: "none",
  } as React.CSSProperties,
  realCaret: {
    position: "absolute",
    visibility: "hidden",
    whiteSpace: "pre",
    pointerEvents: "none",
  } as React.CSSProperties,
  completionRow: { display: "flex", flexWrap: "wrap", gap: "1.5ch" } as React.CSSProperties,
  completionOption: { whiteSpace: "nowrap" } as React.CSSProperties,
};

function makePromptStyle(theme: TerminalTheme): React.CSSProperties {
  return {
    color: theme.promptColor,
    paddingRight: 6,
    whiteSpace: "pre",
    wordBreak: "normal",
    userSelect: "none",
  };
}

function makeCursorStyle(
  theme: ResolvedTerminalTheme,
  cursorOffset: number,
  cursorVisible: boolean,
): React.CSSProperties {
  const base: React.CSSProperties = {
    position: "absolute",
    left: cursorOffset,
    backgroundColor: theme.cursor.color,
    pointerEvents: "none",
    top: 0,
    opacity: theme.cursor.blink ? (cursorVisible ? 1 : 0) : 1,
  };

    // @ts-ignore
  const isTransparentBlock = theme.cursor.shape === "block" && !theme.cursor.solidBlock;
  base.zIndex = isTransparentBlock ? -1 : 6;

  if (theme.cursor.shape === "beam") {
    return { ...base, width: 2, height: "1.2em", top: 2 };
  }
  if (theme.cursor.shape === "block") {
    return { ...base, width: "0.6em", height: "1.2em", top: 2 };
  }
  return { ...base, width: "0.6em", height: "0.2em", transform: "translateY(1.3em)" };
}

const WindowChromeRenderer: React.FC<{ chrome: TerminalWindowChrome }> = ({ chrome }) => {
  const [hoveredControl, setHoveredControl] = useState<HoverState>(null);

  const handleMouseEnter = (kind: HoverState) => setHoveredControl(kind);
  const handleMouseLeave = () => setHoveredControl(null);

  const controls = (["close", "min", "max"] as ControlKind[]).map((kind) => {
    // Icons
    let Icon: React.ReactNode = null;
    if (chrome.style === "mac") {
      Icon = kind === "close" ? <MacCloseIcon /> : kind === "min" ? <MacMinIcon /> : <MacMaxIcon />;
    } else if (chrome.style === "windows") {
      Icon = kind === "min" ? <WinMinIcon /> : kind === "max" ? <WinMaxIcon /> : <WinCloseIcon />;
    } else {
      Icon = kind === "min" ? <LinuxMinIcon /> : kind === "max" ? <LinuxMaxIcon /> : <LinuxCloseIcon />;
    }

    // Windows Logic
    if (chrome.style === "windows") {
      const isHovered = hoveredControl === kind;
      return (
        <span
          key={kind}
          style={makeWindowsControlStyle(chrome, kind, isHovered)}
          title={kind}
          onMouseEnter={() => handleMouseEnter(kind)}
          onMouseLeave={handleMouseLeave}
        >
          {Icon}
        </span>
      );
    }

    // Linux Logic
    if (chrome.style === "linux") {
      const isHovered = hoveredControl === kind;
      return (
        <span
          key={kind}
          style={makeLinuxControlOuterStyle()}
          title={kind}
          onMouseEnter={() => handleMouseEnter(kind)}
          onMouseLeave={handleMouseLeave}
        >
          <span style={makeLinuxControlInnerCircleStyle(chrome, kind, isHovered)} />
          {Icon}
        </span>
      );
    }

    return (
      <span key={kind} style={makeMacControlStyle(chrome, kind)} title={kind}>
        <span
          style={{
            opacity: hoveredControl === "mac-container" ? 1 : 0,
            transition: "opacity 120ms ease-out",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
          }}
        >
          {Icon}
        </span>
      </span>
    );
  });

  return (
    <div style={makeTitlebarStyle(chrome)} aria-hidden="true">
      {chrome.style === "mac" && (
        <>
          <div
            style={makeWindowControlsContainerStyle(chrome)}
            onMouseEnter={() => handleMouseEnter("mac-container")}
            onMouseLeave={handleMouseLeave}
          >
            {controls}
          </div>
          <div style={makeTitleStyle(chrome)}>{chrome.titleBarText}</div>
        </>
      )}

      {chrome.style === "windows" && (
        <>
          <div style={makeTitleStyle(chrome)}>{chrome.titleBarText}</div>
          <div style={makeWindowControlsContainerStyle(chrome)}>
            {controls[1]}{controls[2]}{controls[0]}
          </div>
        </>
      )}

      {chrome.style === "linux" && (
        <>
          <div style={makeTitleStyle(chrome)}>{chrome.titleBarText}</div>
          <div style={makeWindowControlsContainerStyle(chrome)}>
            {controls[1]} {controls[2]} {controls[0]}
          </div>
        </>
      )}
    </div>
  );
};

// Helper to determine if a color is light
function isLightColor(color: string): boolean {
  let r = 0, g = 0, b = 0;

  // Handle hex
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6 || hex.length === 8) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
  } else if (color.startsWith("rgb")) {
    // Basic parsing for rgb/rgba
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      r = parseInt(match[0], 10);
      g = parseInt(match[1], 10);
      b = parseInt(match[2], 10);
    }
  }

  // Calculate perceived brightness (standard formula)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128;
}

function resolvePrompt(promptTemplate: string, cwd: string): string {
  // If no placeholder, return as is
  if (!promptTemplate.includes("{cwd}") && !promptTemplate.includes("{currentDir}")) {
    return promptTemplate;
  }

  const parts = cwd.split("/").filter(Boolean);
  let dir = "";
  if (parts.length === 0) dir = "~";
  else dir = parts[parts.length - 1];

  return promptTemplate
    .replace("{cwd}", dir)
    .replace("{currentDir}", dir);
}

export const Terminal: React.FC<Partial<TerminalProps>> = ({
  fileStructure: fs = DEFAULT_FILE_STRUCTURE,
  startPath = DEFAULT_START_PATH,
  welcomeMessage = DEFAULT_WELCOME_MESSAGE,
  prompt = DEFAULT_PROMPT,
  windowChrome = DEFAULT_CHROME_STYLE,
  theme = DEFAULT_THEME,
  extraCommands,
  className,
  demo,
  style,
}) => {
  const resolvedWindowChrome = useMemo(() => resolveChrome(windowChrome), [windowChrome]);
  const resolvedTheme = useMemo(() => resolveTheme(theme), [theme]);

  // Auto-adjust chrome colors for light themes
  const effectiveWindowChrome = useMemo(() => {
    if (!resolvedWindowChrome || !resolvedTheme.backgroundColor) return resolvedWindowChrome;

    if (isLightColor(resolvedTheme.backgroundColor)) {
      return {
        ...resolvedWindowChrome,
        titleBarTextColor: "rgba(0, 0, 0, 0.7)",
        buttonColors: {
          ...resolvedWindowChrome.buttonColors,
          iconColor: "rgba(0, 0, 0, 0.7)",
          min: resolvedWindowChrome.style !== "mac" ? "rgba(0, 0, 0, 0.1)" : resolvedWindowChrome.buttonColors.min,
          max: resolvedWindowChrome.style !== "mac" ? "rgba(0, 0, 0, 0.1)" : resolvedWindowChrome.buttonColors.max,
          close: resolvedWindowChrome.style === "linux" ? "rgba(0, 0, 0, 0.1)" : resolvedWindowChrome.buttonColors.close,
        },
      };
    }

    return resolvedWindowChrome;
  }, [resolvedWindowChrome, resolvedTheme.backgroundColor]);

  const { state, setInput, setPath, setHistory, submit, complete, navigateHistory, interrupt } =
    useTerminalEngine(fs, startPath, extraCommands);

  const currentPrompt = resolvePrompt(prompt, state.path);

  const [showBanner, setShowBanner] = useState(!!welcomeMessage);
  const [typing, setTyping] = useState(false);
  const [cursorOffset, setCursorOffset] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [demoPhase, setDemoPhase] = useState<"idle" | "running" | "finished">("idle");
  const realCaretRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number>(0);
  const demoCancelRef = useRef({ cancelled: false });
  const demoTimersRef = useRef<number[]>([]);
  const submitRef = useRef(submit);
  submitRef.current = submit;

  // Caret Logic
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
    clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      setTyping(false);
    }, resolvedTheme.cursor.blinkRate);
  };

  useEffect(() => {
    return () => clearTimeout(typingTimer.current);
  }, []);

  // Sync Caret on Input Change (Handles external updates like submit)
  useEffect(() => {
    syncCaretPosition();
  }, [state.input]);

  // Blinking Cursor
  useEffect(() => {
    if (!resolvedTheme.cursor.blink) {
      setCursorVisible(true);
      return;
    }
    if (typing) {
      setCursorVisible(true);
      return;
    }
    const id = window.setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, resolvedTheme.cursor.blinkRate);
    return () => window.clearInterval(id);
  }, [typing, resolvedTheme.cursor.blink, resolvedTheme.cursor.blinkRate]);

  // Auto-scroll
  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [state.history, state.completion]);

  // Demo
  useEffect(() => {
    if (!demo?.script || demo.script.length === 0) {
      demoCancelRef.current.cancelled = true;
      setDemoPhase("idle");
      demoTimersRef.current.forEach((id) => clearTimeout(id));
      demoTimersRef.current = [];
      return;
    }

    demoCancelRef.current.cancelled = false;
    setDemoPhase("running");

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = window.setTimeout(() => resolve(), ms);
        demoTimersRef.current.push(id);
      });

    const defaultCharDelay = demo.defaultCharDelayMs ?? 40;
    const defaultAfterDelay = demo.defaultAfterLineDelayMs ?? 600;
    const behavior = demo.behavior ?? "freeze";
    const loopDelay = demo.loopDelayMs ?? 800;

    const runOnce = async () => {
      for (const step of demo.script) {
        if (demoCancelRef.current.cancelled) return;

        const cfg =
          typeof step === "string"
            ? { line: step }
            : step;

        setInput("");
        markTyping();
        requestAnimationFrame(syncCaretPosition);

        const chars = cfg.line.split("");
        const charDelay = cfg.charDelayMs ?? defaultCharDelay;

        for (const ch of chars) {
          if (demoCancelRef.current.cancelled) return;
          await wait(charDelay);
          setInput((prev) => prev + ch);
          markTyping();
          requestAnimationFrame(syncCaretPosition);
        }

        // Wait for the last character to settle in state before submitting/deleting
        await wait(charDelay);

        const afterDelay = cfg.afterLineDelayMs ?? defaultAfterDelay;

        if (demo.mode === "type-writer") {
          if (afterDelay > 0) {
            await wait(afterDelay);
            if (demoCancelRef.current.cancelled) return;
          }

          // Delete logic
          const currentInput = cfg.line;
          for (let i = 0; i < currentInput.length; i++) {
            if (demoCancelRef.current.cancelled) return;
            await wait(charDelay);
            setInput((prev) => prev.slice(0, -1));
            markTyping();
            requestAnimationFrame(syncCaretPosition);
          }
        } else {
          submitRef.current(currentPrompt);

          if (afterDelay > 0) {
            await wait(afterDelay);
            if (demoCancelRef.current.cancelled) return;
          }
        }

        await wait(10);
      }
    };

    const runDemo = async () => {
      if (behavior === "loop") {
        // Loop forever, clearing between runs
        // eslint-disable-next-line no-constant-condition
        while (true) {
          if (demoCancelRef.current.cancelled) return;

          // Clear history + banner before each loop
          setHistory([]);
          setShowBanner(false);

          await runOnce();
          if (demoCancelRef.current.cancelled) return;

          await wait(loopDelay);
        }
      } else {
        await runOnce();
        if (!demoCancelRef.current.cancelled) {
          setDemoPhase("finished");
        }
      }
    };

    runDemo();

    return () => {
      demoCancelRef.current.cancelled = true;
      demoTimersRef.current.forEach((id) => clearTimeout(id));
      demoTimersRef.current = [];
    };
  }, [
    demo?.behavior,
    demo?.script,
    demo?.defaultCharDelayMs,
    demo?.defaultAfterLineDelayMs,
    demo?.loopDelayMs,
    demo?.mode,
    setHistory,
  ]);

  // Handlers
  const handleBodyFocus = () => {
    inputRef.current?.focus();
    requestAnimationFrame(syncCaretPosition);
  };

  const isInputDisabled = (demoPhase === "running" ||
    (demoPhase === "finished" && (demo?.behavior ?? "freeze") === "freeze"));


  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (isInputDisabled) {
      event.preventDefault();
      return;
    }
    markTyping();
    // Ctrl+C
    if (event.key === "c" && event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      interrupt(currentPrompt);
      requestAnimationFrame(syncCaretPosition);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (state.input.trim().split(/\s+/)[0] === "clear") setShowBanner(false);
      submit(currentPrompt);
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
  };


  const windowStyle = useMemo(() => makeWindowStyle(resolvedTheme, effectiveWindowChrome), [resolvedTheme, effectiveWindowChrome]);
  const promptStyle = useMemo(() => makePromptStyle(resolvedTheme), [resolvedTheme]);
  const cursorStyle = useMemo(
    () => makeCursorStyle(resolvedTheme, cursorOffset, cursorVisible),
    [resolvedTheme, cursorOffset, cursorVisible]
  );

  return (
    <div className={className ?? ""} style={{ width: "100%", height: "100%", maxHeight: "100%", display: "flex", flexDirection: "column", ...style }}>
      <div style={{ ...windowStyle, width: "100%", height: "100%", flex: "1 1 auto", minHeight: 0 }}>

        {effectiveWindowChrome && <WindowChromeRenderer chrome={effectiveWindowChrome} />}

        <div ref={bodyRef} style={styles.body} tabIndex={-1} onFocus={handleBodyFocus}>

          {showBanner && welcomeMessage && <div style={styles.row}>{welcomeMessage}</div>}

          {state.history.map((entry, index) => (
            <div key={index} style={index === 0 ? { ...styles.row, marginTop: 0 } : styles.row}>
              <div style={styles.historyLine}>
                <span style={promptStyle}>{entry.in ? (entry.prompt || currentPrompt) : currentPrompt}</span>
                {entry.in}
              </div>
              {entry.out && <div style={styles.historyLine}>{entry.out}</div>}
            </div>
          ))}

          <div style={styles.inputRow}>
            <span style={promptStyle}>{currentPrompt}</span>
            <span style={styles.inputContainer}>
              <span style={styles.inputText}>{state.input || "\u00A0"}</span>
              <span ref={realCaretRef} style={styles.realCaret} aria-hidden />
              <span style={cursorStyle} aria-hidden />
              <input
                ref={inputRef}
                style={styles.hiddenInput}
                value={state.input}
                disabled={isInputDisabled}
                onChange={(e) => {
                  setInput(e.target.value);
                  markTyping();
                  requestAnimationFrame(syncCaretPosition);
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                onKeyDown={handleInputKeyDown}
                onKeyUp={() => requestAnimationFrame(syncCaretPosition)}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
              />
            </span>
          </div>

          {state.completion && state.completion.options.length > 1 && (
            <div style={styles.completionRow}>
              {state.completion.options.map((option, index) => (
                <span key={index} style={styles.completionOption}>
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
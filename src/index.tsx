import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type {
  TerminalProps,
  TerminalTheme,
  WindowChromeStyle,
  TerminalWindowChrome,
  DirectoryNode,
  CursorOptions,
  TitleBarCwdMode,
} from './types';
import { useTerminalEngine } from './hooks';
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
} from './assets';
export * from './types';
import { PRESET_THEMES, CHROME_STYLES } from './themes';

// useLayoutEffect warns during SSR on React 18, so fall back to useEffect on the server
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

type ResolvedTerminalTheme = TerminalTheme & { cursor: CursorOptions };

// Defaults
const DEFAULT_PROMPT = '{user}@{cwd}:$ ';
const DEFAULT_USERNAME = 'guest';
const DEFAULT_HOSTNAME = 'one-terminal';
const DEFAULT_WELCOME_MESSAGE = '';
const DEFAULT_START_PATH = '/';
const DEFAULT_THEME: TerminalTheme = PRESET_THEMES['dracula'];
const DEFAULT_CHROME_STYLE: Exclude<WindowChromeStyle, 'none'> = 'mac';
const DEFAULT_WINDOW_CHROME: TerminalWindowChrome = CHROME_STYLES[DEFAULT_CHROME_STYLE];
const DEFAULT_FILE_STRUCTURE: DirectoryNode = { kind: 'directory', entries: {} };

function resolveTheme(themeProp: TerminalProps['theme']): ResolvedTerminalTheme {
  let preset: TerminalTheme = DEFAULT_THEME;
  let overrides: Partial<TerminalTheme> = {};

  if (Array.isArray(themeProp)) {
    const [presetName, themeOverrides] = themeProp;

    if (typeof presetName === 'string') {
      if (presetName in PRESET_THEMES) {
        preset = PRESET_THEMES[presetName as keyof typeof PRESET_THEMES];
      } else {
        console.warn(`Terminal: unrecognized theme preset name "${presetName}", falling back to default theme.`);
      }
    } else if (presetName != null) {
      console.warn(`Terminal: invalid theme preset name in array, expected string but got ${typeof presetName}.`);
    }

    if (typeof themeOverrides === 'object') {
      overrides = themeOverrides as Partial<TerminalTheme>;
    } else if (themeOverrides != null) {
      console.warn(`Terminal: invalid theme overrides in array, expected object but got ${typeof themeOverrides}.`);
    }
  } else if (typeof themeProp === 'string') {
    if (themeProp in PRESET_THEMES) {
      preset = PRESET_THEMES[themeProp as keyof typeof PRESET_THEMES];
    } else {
      console.warn(`Terminal: unrecognized theme preset name "${themeProp}", falling back to default theme.`);
    }
  } else if (typeof themeProp === 'object' && themeProp !== null) {
    overrides = { ...(themeProp as TerminalTheme) };
  } else if (themeProp != null) {
    console.warn(
      `Terminal: invalid theme prop, expected string, object, or [string, object] but got ${typeof themeProp}.`,
    );
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

function resolveChrome(windowChromeProp: TerminalProps['windowChrome']): TerminalWindowChrome | null {
  if (windowChromeProp === 'none') return null;

  let preset: TerminalWindowChrome = DEFAULT_WINDOW_CHROME;
  let overrides: Partial<TerminalWindowChrome> = {};

  if (Array.isArray(windowChromeProp)) {
    const [presetName, windowOverrides] = windowChromeProp;
    if (typeof presetName === 'string') {
      if (presetName in CHROME_STYLES) {
        preset = CHROME_STYLES[presetName as keyof typeof CHROME_STYLES];
      } else {
        console.warn(
          `Terminal: unrecognized window chrome preset name "${presetName}", falling back to default window chrome style.`,
        );
      }
    } else if (presetName != null) {
      console.warn(
        `Terminal: invalid window chrome preset name in array, expected string but got ${typeof presetName}.`,
      );
    }

    if (typeof windowOverrides === 'object') {
      overrides = windowOverrides as Partial<TerminalWindowChrome>;
    } else if (windowOverrides != null) {
      console.warn(
        `Terminal: invalid window chrome overrides in array, expected object but got ${typeof windowOverrides}.`,
      );
    }
  } else if (typeof windowChromeProp === 'string') {
    if (windowChromeProp in CHROME_STYLES) {
      preset = CHROME_STYLES[windowChromeProp];
    } else {
      console.warn(
        `Terminal: unrecognised window chrome style "${windowChromeProp}", falling back to "${DEFAULT_CHROME_STYLE}".`,
      );
    }
  } else if (typeof windowChromeProp === 'object' && windowChromeProp !== null) {
    overrides = { ...(windowChromeProp as TerminalWindowChrome) };
  } else if (windowChromeProp != null) {
    console.warn(
      `Terminal: invalid windowChrome prop, expected "none", string, or [string, object] but got ${typeof windowChromeProp}.`,
    );
  }

  const merged: TerminalWindowChrome = { ...preset, ...overrides };

  return {
    style: merged.style,
    cornerRadius: merged.cornerRadius!,
    titleBarText: merged.titleBarText ?? '',
    titleBarCwd: merged.titleBarCwd ?? 'basename',
    titleBarSeparator: merged.titleBarSeparator ?? ' — ',
    titleBarTextColor: merged.titleBarTextColor!,
    buttonColors: {
      close: merged.buttonColors?.close,
      min: merged.buttonColors?.min,
      max: merged.buttonColors?.max,
      iconColor: merged.buttonColors?.iconColor,
    },
  };
}

function makeWindowStyle(theme: TerminalTheme, chrome: TerminalWindowChrome | null): React.CSSProperties {
  return {
    backgroundColor: chrome ? theme.backgroundColor : 'transparent',
    borderRadius: chrome ? chrome.cornerRadius : undefined,
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize,
    color: theme.textColor,
    lineHeight: theme.lineHeight,
    clipPath: chrome ? `inset(0 round ${chrome.cornerRadius}px)` : undefined,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };
}

function makeTitlebarStyle(chrome: TerminalWindowChrome): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    flexShrink: 0,
  };

  if (chrome.style === 'mac') return { ...base, padding: '12px' };
  if (chrome.style === 'windows') {
    return {
      ...base,
      height: 32,
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.181)',
    };
  }
  return { ...base, justifyContent: 'flex-end' };
}

function makeTitleStyle(chrome: TerminalWindowChrome): React.CSSProperties {
  const base: React.CSSProperties = {
    fontSize: 13,
    color: chrome.titleBarTextColor,
    pointerEvents: 'none',
    userSelect: 'none',
  };

  if (chrome.style === 'mac' || chrome.style === 'linux') {
    return {
      ...base,
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }
  return { ...base, marginLeft: 10 };
}

function makeWindowControlsContainerStyle(chrome: TerminalWindowChrome): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: chrome.buttonColors.iconColor,
    height: '100%',
  };

  if (chrome.style === 'mac') return { ...base, gap: 8 };
  return base;
}

type ControlKind = 'close' | 'min' | 'max';
type HoverState = ControlKind | 'mac-container' | null;

function makeMacControlStyle(chrome: TerminalWindowChrome, kind: ControlKind): React.CSSProperties {
  const background =
    kind === 'close' ? chrome.buttonColors.close : kind === 'min' ? chrome.buttonColors.min : chrome.buttonColors.max;

  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 11,
    height: 11,
    borderRadius: '50%',
    padding: 0,
    background: background,
  };
}

function makeWindowsControlStyle(
  chrome: TerminalWindowChrome,
  kind: ControlKind,
  hovered: boolean,
): React.CSSProperties {
  let background = 'transparent';
  if (hovered) {
    if (kind === 'close') background = chrome.buttonColors.close!;
    else if (kind === 'min') background = chrome.buttonColors.min!;
    else background = chrome.buttonColors.max!;
  }

  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 46,
    height: '100%',
    background,
    transition: 'background 0.1s',
  };
}

function makeLinuxControlOuterStyle(): React.CSSProperties {
  return {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 24,
    height: 24,
    borderRadius: '50%',
  };
}

function makeLinuxControlInnerCircleStyle(
  chrome: TerminalWindowChrome,
  kind: ControlKind,
  hovered: boolean,
): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    width: '70%',
    height: '70%',
    borderRadius: '50%',
    zIndex: 1,
    background: 'transparent',
  };

  if (!hovered) return base;

  const background =
    kind === 'close' ? chrome.buttonColors.close : kind === 'min' ? chrome.buttonColors.min : chrome.buttonColors.max;

  return { ...base, background };
}

const styles = {
  body: { padding: 10, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' } as React.CSSProperties,
  row: { flexShrink: 0 } as React.CSSProperties,
  historyLine: { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } as React.CSSProperties,
  inputRow: {
    position: 'relative',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  } as React.CSSProperties,
  inputContainer: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    flex: 1,
  } as React.CSSProperties,
  inputText: {
    whiteSpace: 'pre',
    display: 'inline-block',
    lineHeight: 1,
    font: 'inherit',
    minHeight: '1em',
  } as React.CSSProperties,
  hiddenInput: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    border: 'none',
    outline: 'none',
    color: 'transparent',
    background: 'transparent',
    caretColor: 'transparent',
    font: 'inherit',
    resize: 'none',
  } as React.CSSProperties,
  realCaret: {
    position: 'absolute',
    visibility: 'hidden',
    whiteSpace: 'pre',
    pointerEvents: 'none',
  } as React.CSSProperties,
  completionRow: { display: 'flex', flexWrap: 'wrap', gap: '1.5ch' } as React.CSSProperties,
  completionOption: { whiteSpace: 'nowrap' } as React.CSSProperties,
};

function makePromptStyle(theme: TerminalTheme): React.CSSProperties {
  return {
    color: theme.promptColor,
    paddingRight: 6,
    whiteSpace: 'pre',
    wordBreak: 'normal',
    userSelect: 'none',
  };
}

function makeCursorStyle(
  theme: ResolvedTerminalTheme,
  cursorOffset: number,
  cursorVisible: boolean,
): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    left: cursorOffset,
    backgroundColor: theme.cursor.color,
    pointerEvents: 'none',
    top: 0,
    opacity: theme.cursor.blink ? (cursorVisible ? 1 : 0) : 1,
  };

  const isTransparentBlock = theme.cursor.shape === 'block' && !theme.cursor.solidBlock;
  base.zIndex = isTransparentBlock ? -1 : 6;

  if (theme.cursor.shape === 'beam') {
    return { ...base, width: 2, height: '1.2em', top: 2 };
  }
  if (theme.cursor.shape === 'block') {
    return { ...base, width: '0.6em', height: '1.2em', top: 2 };
  }
  return { ...base, width: '0.6em', height: '0.2em', transform: 'translateY(1.3em)' };
}

const WindowChromeRenderer: React.FC<{ chrome: TerminalWindowChrome; title: string }> = ({ chrome, title }) => {
  const [hoveredControl, setHoveredControl] = useState<HoverState>(null);

  const handleMouseEnter = (kind: HoverState) => setHoveredControl(kind);
  const handleMouseLeave = () => setHoveredControl(null);

  const controls = (['close', 'min', 'max'] as ControlKind[]).map((kind) => {
    // Icons
    let Icon: React.ReactNode = null;
    if (chrome.style === 'mac') {
      Icon = kind === 'close' ? <MacCloseIcon /> : kind === 'min' ? <MacMinIcon /> : <MacMaxIcon />;
    } else if (chrome.style === 'windows') {
      Icon = kind === 'min' ? <WinMinIcon /> : kind === 'max' ? <WinMaxIcon /> : <WinCloseIcon />;
    } else {
      Icon = kind === 'min' ? <LinuxMinIcon /> : kind === 'max' ? <LinuxMaxIcon /> : <LinuxCloseIcon />;
    }

    // Windows Logic
    if (chrome.style === 'windows') {
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
    if (chrome.style === 'linux') {
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
            opacity: hoveredControl === 'mac-container' ? 1 : 0,
            transition: 'opacity 120ms ease-out',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
          }}
        >
          {Icon}
        </span>
      </span>
    );
  });

  return (
    <div style={makeTitlebarStyle(chrome)} aria-hidden="true">
      {chrome.style === 'mac' && (
        <>
          <div
            style={makeWindowControlsContainerStyle(chrome)}
            onMouseEnter={() => handleMouseEnter('mac-container')}
            onMouseLeave={handleMouseLeave}
          >
            {controls}
          </div>
          <div style={makeTitleStyle(chrome)}>{title}</div>
        </>
      )}

      {chrome.style === 'windows' && (
        <>
          <div style={makeTitleStyle(chrome)}>{title}</div>
          <div style={makeWindowControlsContainerStyle(chrome)}>
            {controls[1]}
            {controls[2]}
            {controls[0]}
          </div>
        </>
      )}

      {chrome.style === 'linux' && (
        <>
          <div style={makeTitleStyle(chrome)}>{title}</div>
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
  let r = 0,
    g = 0,
    b = 0;

  // Handle hex
  if (color.startsWith('#')) {
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
  } else if (color.startsWith('rgb')) {
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

const PLACEHOLDER_RE = /\{(cwd|currentDir|path|user|host)\}/;

function formatCwd(cwd: string, mode: Exclude<TitleBarCwdMode, 'none'>): string {
  const parts = cwd.split('/').filter(Boolean);
  if (parts.length === 0) return '~';
  return mode === 'basename' ? parts[parts.length - 1] : `~/${parts.join('/')}`;
}

type PlaceholderValues = { cwd: string; user: string; host: string };

function fillPlaceholders(template: string, { cwd, user, host }: PlaceholderValues): string {
  return template
    .replace(/\{(cwd|currentDir)\}/g, formatCwd(cwd, 'basename'))
    .replace(/\{path\}/g, formatCwd(cwd, 'full'))
    .replace(/\{user\}/g, user)
    .replace(/\{host\}/g, host);
}

function resolvePrompt(promptTemplate: string, values: PlaceholderValues): string {
  return fillPlaceholders(promptTemplate, values);
}

function resolveTitle(chrome: TerminalWindowChrome, values: PlaceholderValues): string {
  const text = chrome.titleBarText ?? '';
  if (PLACEHOLDER_RE.test(text)) return fillPlaceholders(text, values);
  if (chrome.titleBarCwd === 'none') return text;

  const dir = formatCwd(values.cwd, chrome.titleBarCwd);
  return text ? `${text}${chrome.titleBarSeparator}${dir}` : dir;
}

export const Terminal: React.FC<Partial<TerminalProps>> = ({
  fileStructure: fs = DEFAULT_FILE_STRUCTURE,
  startPath = DEFAULT_START_PATH,
  welcomeMessage = DEFAULT_WELCOME_MESSAGE,
  prompt = DEFAULT_PROMPT,
  username = DEFAULT_USERNAME,
  hostname = DEFAULT_HOSTNAME,
  neofetch,
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
        titleBarTextColor: 'rgba(0, 0, 0, 0.7)',
        buttonColors: {
          ...resolvedWindowChrome.buttonColors,
          iconColor: 'rgba(0, 0, 0, 0.7)',
          min: resolvedWindowChrome.style !== 'mac' ? 'rgba(0, 0, 0, 0.1)' : resolvedWindowChrome.buttonColors.min,
          max: resolvedWindowChrome.style !== 'mac' ? 'rgba(0, 0, 0, 0.1)' : resolvedWindowChrome.buttonColors.max,
          close:
            resolvedWindowChrome.style === 'linux' ? 'rgba(0, 0, 0, 0.1)' : resolvedWindowChrome.buttonColors.close,
        },
      };
    }

    return resolvedWindowChrome;
  }, [resolvedWindowChrome, resolvedTheme.backgroundColor]);

  const {
    state,
    setInput,
    setHistory,
    submit,
    complete,
    navigateHistory,
    interrupt,
    clearScreen,
    startSearch,
    setSearchQuery,
    acceptSearch,
    cancelSearch,
    operateAndGetNext,
    getLastArgument,
  } = useTerminalEngine({
    fs,
    startPath,
    extraCommands,
    username,
    hostname,
    neofetch,
    accentColor: resolvedTheme.promptColor,
  });

  const placeholders = { cwd: state.path, user: username, host: hostname };
  const currentPrompt = resolvePrompt(prompt, placeholders);
  const currentTitle = effectiveWindowChrome ? resolveTitle(effectiveWindowChrome, placeholders) : '';

  const [showBanner, setShowBanner] = useState(!!welcomeMessage);
  const [typing, setTyping] = useState(false);
  const [cursorOffset, setCursorOffset] = useState(0);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [demoPhase, setDemoPhase] = useState<'idle' | 'running' | 'finished'>('idle');
  const realCaretRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number>(0);
  const demoTimersRef = useRef<number[]>([]);
  // Latest values for the demo runner, which outlives individual renders
  const latestRef = useRef({ submit, currentPrompt, markTyping: () => {} });

  // While searching history, the cursor sits on the match instead of the input
  const searchCaretRef = useRef<{ text: string; index: number } | null>(null);
  searchCaretRef.current = state.search
    ? {
        text: state.searchMatch,
        index: Math.max(0, state.search.query ? state.searchMatch.indexOf(state.search.query) : 0),
      }
    : null;

  // Caret Logic
  const syncCaretPosition = () => {
    const input = inputRef.current;
    const measurer = realCaretRef.current;
    if (!input || !measurer) return;

    const searchCaret = searchCaretRef.current;
    const value = searchCaret ? searchCaret.text : input.value;
    const caretIndex = searchCaret ? searchCaret.index : (input.selectionStart ?? value.length);

    if (caretIndex === 0) {
      measurer.textContent = '';
      setCursorOffset(0);
      return;
    }
    const textBeforeCursor = value.slice(0, caretIndex);
    measurer.textContent = textBeforeCursor || '\u00A0';
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
  latestRef.current = { submit, currentPrompt, markTyping };

  useEffect(() => {
    return () => clearTimeout(typingTimer.current);
  }, []);

  // Sync Caret on Input Change (Handles external updates like submit)
  useEffect(() => {
    syncCaretPosition();
  }, [state.input, state.search, state.busy]);

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
  }, [state.history, state.completion, state.search, state.busy]);

  // Demo
  useEffect(() => {
    if (!demo?.script || demo.script.length === 0) {
      setDemoPhase('idle');
      demoTimersRef.current.forEach((id) => clearTimeout(id));
      demoTimersRef.current = [];
      return;
    }

    // Each run gets its own cancel token so a restarted demo can't be resumed by an old one
    const run = { cancelled: false };
    setDemoPhase('running');

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = window.setTimeout(() => resolve(), ms);
        demoTimersRef.current.push(id);
      });

    const defaultCharDelay = demo.defaultCharDelayMs ?? 40;
    const defaultAfterDelay = demo.defaultAfterLineDelayMs ?? 600;
    const behavior = demo.behavior ?? 'freeze';
    const loopDelay = demo.loopDelayMs ?? 800;

    const runOnce = async () => {
      for (const step of demo.script) {
        if (run.cancelled) return;

        const cfg = typeof step === 'string' ? { line: step } : step;

        setInput('');
        latestRef.current.markTyping();
        requestAnimationFrame(syncCaretPosition);

        const chars = cfg.line.split('');
        const charDelay = cfg.charDelayMs ?? defaultCharDelay;

        for (const ch of chars) {
          if (run.cancelled) return;
          await wait(charDelay);
          setInput((prev) => prev + ch);
          latestRef.current.markTyping();
          requestAnimationFrame(syncCaretPosition);
        }

        // Wait for the last character to settle in state before submitting/deleting
        await wait(charDelay);

        const afterDelay = cfg.afterLineDelayMs ?? defaultAfterDelay;

        if (demo.mode === 'type-writer') {
          if (afterDelay > 0) {
            await wait(afterDelay);
            if (run.cancelled) return;
          }

          // Delete logic
          const currentInput = cfg.line;
          for (let i = 0; i < currentInput.length; i++) {
            if (run.cancelled) return;
            await wait(charDelay);
            setInput((prev) => prev.slice(0, -1));
            latestRef.current.markTyping();
            requestAnimationFrame(syncCaretPosition);
          }
        } else {
          latestRef.current.submit(latestRef.current.currentPrompt);

          if (afterDelay > 0) {
            await wait(afterDelay);
            if (run.cancelled) return;
          }
        }

        await wait(10);
      }
    };

    const runDemo = async () => {
      if (behavior === 'loop') {
        // Loop forever, clearing between runs
        while (true) {
          if (run.cancelled) return;

          // Clear history + banner before each loop
          setHistory([]);
          setShowBanner(false);

          await runOnce();
          if (run.cancelled) return;

          await wait(loopDelay);
        }
      } else {
        await runOnce();
        if (!run.cancelled) {
          setDemoPhase('finished');
        }
      }
    };

    runDemo();

    const timers = demoTimersRef.current;
    return () => {
      run.cancelled = true;
      timers.forEach((id) => clearTimeout(id));
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
    setInput,
  ]);

  // Handlers
  const handleBodyFocus = () => {
    inputRef.current?.focus();
    requestAnimationFrame(syncCaretPosition);
  };

  const isInputDisabled =
    demoPhase === 'running' || (demoPhase === 'finished' && (demo?.behavior ?? 'freeze') === 'freeze');

  // Edits the line around the caret and puts the caret where `fn` says.
  const editLine = (fn: (value: string, start: number, end: number) => [string, number]) => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? state.input.length;
    const end = el.selectionEnd ?? start;
    const [next, caret] = fn(state.input, start, end);
    if (next !== state.input) {
      // Applied right after React re-renders the input (see the layout effect below),
      // so a key pressed immediately after sees the right caret
      pendingCaretRef.current = caret;
      setInput(next);
    } else {
      el.setSelectionRange(caret, caret);
      syncCaretPosition();
    }
  };

  useIsomorphicLayoutEffect(() => {
    const caret = pendingCaretRef.current;
    if (caret === null || !inputRef.current) return;
    pendingCaretRef.current = null;
    inputRef.current.setSelectionRange(caret, caret);
    syncCaretPosition();
  });

  const pendingCaretRef = useRef<number | null>(null);

  // Text removed by Ctrl+U/K/W and Alt+D/Backspace, pasted back with Ctrl+Y
  const killRingRef = useRef('');

  /** Deletes value[from, to) into the kill ring and leaves the caret at `from`. */
  const killRange = (getRange: (value: string, caret: number) => [number, number]) =>
    editLine((v, caret) => {
      const [from, to] = getRange(v, caret);
      if (to > from) killRingRef.current = v.slice(from, to);
      return [v.slice(0, from) + v.slice(to), from];
    });

  const insertText = (text: string) =>
    editLine((v, start, end) => [v.slice(0, start) + text + v.slice(end), start + text.length]);

  const handleClearScreen = () => clearScreen();

  // `clear` / Ctrl+L also remove the welcome banner
  useEffect(() => {
    if (state.clearCount) setShowBanner(false);
  }, [state.clearCount]);

  const handleInterrupt = () => {
    interrupt(currentPrompt);
    requestAnimationFrame(syncCaretPosition);
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, ctrlKey: string | null) => {
    const search = state.search!;
    event.preventDefault();

    if (ctrlKey === 'r') startSearch('reverse');
    else if (ctrlKey === 's') startSearch('forward');
    else if (ctrlKey === 'g') cancelSearch();
    else if (ctrlKey === 'c') handleInterrupt();
    else if (ctrlKey === 'o') operateAndGetNext(currentPrompt);
    else if (ctrlKey === 'l') handleClearScreen();
    else if (event.key === 'Enter') submit(currentPrompt, state.searchMatch);
    else if (event.key === 'Backspace' || ctrlKey === 'h') setSearchQuery(search.query.slice(0, -1));
    else if (event.key.length === 1 && !ctrlKey && !event.metaKey && !event.altKey) {
      setSearchQuery(search.query + event.key);
    } else if (!['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(event.key)) {
      // Anything else (Esc, arrows, Tab, ...) leaves search keeping the match
      acceptSearch();
    }
    requestAnimationFrame(syncCaretPosition);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (isInputDisabled) {
      event.preventDefault();
      return;
    }
    markTyping();

    const ctrlKey =
      event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey ? event.key.toLowerCase() : null;

    // Let Ctrl+C copy when there is selected text outside the input
    if (ctrlKey === 'c' && window.getSelection()?.toString()) return;

    // A command (e.g. sleep) is running: only Ctrl+C and Ctrl+L do anything
    if (state.busy) {
      if (event.key !== 'Shift' && !event.metaKey) event.preventDefault();
      if (ctrlKey === 'c') handleInterrupt();
      else if (ctrlKey === 'l') handleClearScreen();
      return;
    }

    if (state.search) {
      handleSearchKeyDown(event, ctrlKey);
      return;
    }

    if (ctrlKey) {
      switch (ctrlKey) {
        case 'c':
          handleInterrupt();
          break;
        case 'l':
          handleClearScreen();
          break;
        case 'a': // Start of line
          editLine((v) => [v, 0]);
          break;
        case 'e': // End of line
          editLine((v) => [v, v.length]);
          break;
        case 'b': // Back one character
          editLine((v, start) => [v, Math.max(0, start - 1)]);
          break;
        case 'f': // Forward one character
          editLine((v, start) => [v, Math.min(v.length, start + 1)]);
          break;
        case 'h': // Backspace
          editLine((v, start, end) =>
            start !== end
              ? [v.slice(0, start) + v.slice(end), start]
              : start > 0
                ? [v.slice(0, start - 1) + v.slice(start), start - 1]
                : [v, 0],
          );
          break;
        case 'd': // Delete the character under the cursor
          editLine((v, start, end) =>
            start !== end ? [v.slice(0, start) + v.slice(end), start] : [v.slice(0, start) + v.slice(start + 1), start],
          );
          break;
        case 'u': // Cut to start of line
          killRange((_, caret) => [0, caret]);
          break;
        case 'k': // Cut to end of line
          killRange((v, caret) => [caret, v.length]);
          break;
        case 'w': // Cut previous whitespace-delimited word
          killRange((v, caret) => {
            let i = caret;
            while (i > 0 && /\s/.test(v[i - 1])) i--;
            while (i > 0 && !/\s/.test(v[i - 1])) i--;
            return [i, caret];
          });
          break;
        case 'y': // Paste what was last cut
          if (killRingRef.current) insertText(killRingRef.current);
          break;
        case 't': // Swap the two characters before the cursor
          editLine((v, caret) => {
            if (v.length < 2 || caret === 0) return [v, caret];
            const at = caret === v.length ? caret - 1 : caret;
            return [v.slice(0, at - 1) + v[at] + v[at - 1] + v.slice(at + 1), at + 1];
          });
          break;
        case 'i': // Same as Tab
          complete();
          break;
        case 'p':
          navigateHistory('up');
          break;
        case 'n':
          navigateHistory('down');
          break;
        case 'r':
          startSearch('reverse');
          break;
        case 's':
          startSearch('forward');
          break;
        case 'o':
          operateAndGetNext(currentPrompt);
          break;
        default:
          return; // Let the browser handle other Ctrl shortcuts
      }
      event.preventDefault();
      requestAnimationFrame(syncCaretPosition);
      return;
    }

    // Alt/Option shortcuts (event.code, since Option+key types symbols on macOS)
    if (event.altKey && !event.ctrlKey && !event.metaKey) {
      const isWord = (ch: string | undefined) => !!ch && /[A-Za-z0-9]/.test(ch);
      const wordStart = (v: string, i: number) => {
        while (i > 0 && !isWord(v[i - 1])) i--;
        while (i > 0 && isWord(v[i - 1])) i--;
        return i;
      };
      const wordEnd = (v: string, i: number) => {
        while (i < v.length && !isWord(v[i])) i++;
        while (i < v.length && isWord(v[i])) i++;
        return i;
      };

      switch (event.code) {
        case 'KeyB':
          editLine((v, caret) => [v, wordStart(v, caret)]);
          break;
        case 'KeyF':
          editLine((v, caret) => [v, wordEnd(v, caret)]);
          break;
        case 'KeyD':
          killRange((v, caret) => [caret, wordEnd(v, caret)]);
          break;
        case 'Backspace':
          killRange((v, caret) => [wordStart(v, caret), caret]);
          break;
        case 'Period': {
          const arg = getLastArgument();
          if (arg) insertText(arg);
          break;
        }
        default:
          return;
      }
      event.preventDefault();
      requestAnimationFrame(syncCaretPosition);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      submit(currentPrompt);
      requestAnimationFrame(syncCaretPosition);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      complete();
      requestAnimationFrame(syncCaretPosition);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      navigateHistory('up');
      requestAnimationFrame(syncCaretPosition);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      navigateHistory('down');
      requestAnimationFrame(syncCaretPosition);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      requestAnimationFrame(syncCaretPosition);
    }
  };

  const searchLabel = state.search
    ? `(${state.search.failed ? 'failed ' : ''}${state.search.direction === 'reverse' ? 'reverse-' : ''}i-search)\`${state.search.query}': `
    : null;

  const windowStyle = useMemo(
    () => makeWindowStyle(resolvedTheme, effectiveWindowChrome),
    [resolvedTheme, effectiveWindowChrome],
  );
  const promptStyle = useMemo(() => makePromptStyle(resolvedTheme), [resolvedTheme]);
  const cursorStyle = useMemo(
    () => makeCursorStyle(resolvedTheme, cursorOffset, cursorVisible),
    [resolvedTheme, cursorOffset, cursorVisible],
  );

  return (
    <div
      className={className ?? ''}
      style={{ width: '100%', height: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column', ...style }}
    >
      <div style={{ ...windowStyle, width: '100%', height: '100%', flex: '1 1 auto', minHeight: 0 }}>
        {effectiveWindowChrome && <WindowChromeRenderer chrome={effectiveWindowChrome} title={currentTitle} />}

        <div ref={bodyRef} style={styles.body} tabIndex={-1} onFocus={handleBodyFocus}>
          {showBanner && welcomeMessage && <div style={{ ...styles.row, ...styles.historyLine }}>{welcomeMessage}</div>}

          {state.history.map((entry, index) => (
            <div key={index} style={index === 0 ? { ...styles.row, marginTop: 0 } : styles.row}>
              <div style={styles.historyLine}>
                <span style={promptStyle}>{entry.in ? entry.prompt || currentPrompt : currentPrompt}</span>
                {entry.in}
              </div>
              {entry.out && <div style={styles.historyLine}>{entry.out}</div>}
            </div>
          ))}

          <div style={styles.inputRow}>
            {searchLabel !== null ? (
              <span style={{ ...promptStyle, color: 'inherit' }}>{searchLabel}</span>
            ) : (
              !state.busy && <span style={promptStyle}>{currentPrompt}</span>
            )}
            <span style={styles.inputContainer}>
              <span style={styles.inputText}>
                {(state.search ? state.searchMatch : state.busy ? '' : state.input) || '\u00A0'}
              </span>
              <span ref={realCaretRef} style={styles.realCaret} aria-hidden />
              <span style={cursorStyle} aria-hidden />
              <input
                ref={inputRef}
                style={styles.hiddenInput}
                value={state.input}
                disabled={isInputDisabled}
                onChange={(e) => {
                  if (state.busy || state.search) return;
                  setInput(e.target.value);
                  markTyping();
                  requestAnimationFrame(syncCaretPosition);
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                onPaste={(e) => {
                  if (!state.search) return;
                  e.preventDefault();
                  setSearchQuery(state.search.query + e.clipboardData.getData('text').replace(/\s+/g, ' '));
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

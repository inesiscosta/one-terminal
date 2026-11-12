import type {
  CursorOptions,
  DirectoryNode,
  TerminalProps,
  TerminalTheme,
  TerminalWindowChrome,
  TitleBarCwdMode,
  WindowChromeStyle,
} from './types';
import { CHROME_STYLES, PRESET_THEMES } from './themes';

// Pure helpers that turn props into the values the component renders with.

export type ResolvedTerminalTheme = TerminalTheme & { cursor: CursorOptions };

export const DEFAULT_PROMPT = '{user}@{cwd}:$ ';
export const DEFAULT_USERNAME = 'guest';
export const DEFAULT_HOSTNAME = 'one-terminal';
export const DEFAULT_SHELL_NAME = 'zsh';
export const DEFAULT_WELCOME_MESSAGE = '';
export const DEFAULT_START_PATH = '/';
export const DEFAULT_THEME: TerminalTheme = PRESET_THEMES['dracula'];
export const DEFAULT_CHROME_STYLE: Exclude<WindowChromeStyle, 'none'> = 'mac';
export const DEFAULT_WINDOW_CHROME: TerminalWindowChrome = CHROME_STYLES[DEFAULT_CHROME_STYLE];
export const DEFAULT_FILE_STRUCTURE: DirectoryNode = { kind: 'directory', entries: {} };

export function resolveTheme(themeProp: TerminalProps['theme']): ResolvedTerminalTheme {
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

export function resolveChrome(windowChromeProp: TerminalProps['windowChrome']): TerminalWindowChrome | null {
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

/** Darkens the title and button colors when the terminal background is light, so they stay readable. */
export function adaptChromeToBackground(
  chrome: TerminalWindowChrome | null,
  backgroundColor: string | undefined,
): TerminalWindowChrome | null {
  if (!chrome || !backgroundColor || !isLightColor(backgroundColor)) return chrome;

  return {
    ...chrome,
    titleBarTextColor: 'rgba(0, 0, 0, 0.7)',
    buttonColors: {
      ...chrome.buttonColors,
      iconColor: 'rgba(0, 0, 0, 0.7)',
      min: chrome.style !== 'mac' ? 'rgba(0, 0, 0, 0.1)' : chrome.buttonColors.min,
      max: chrome.style !== 'mac' ? 'rgba(0, 0, 0, 0.1)' : chrome.buttonColors.max,
      close: chrome.style === 'linux' ? 'rgba(0, 0, 0, 0.1)' : chrome.buttonColors.close,
    },
  };
}

// Helper to determine if a color is light
export function isLightColor(color: string): boolean {
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

export function formatCwd(cwd: string, mode: Exclude<TitleBarCwdMode, 'none'>): string {
  const parts = cwd.split('/').filter(Boolean);
  if (parts.length === 0) return '~';
  return mode === 'basename' ? parts[parts.length - 1] : `~/${parts.join('/')}`;
}

export type PlaceholderValues = { cwd: string; user: string; host: string };

export function fillPlaceholders(template: string, { cwd, user, host }: PlaceholderValues): string {
  return template
    .replace(/\{(cwd|currentDir)\}/g, formatCwd(cwd, 'basename'))
    .replace(/\{path\}/g, formatCwd(cwd, 'full'))
    .replace(/\{user\}/g, user)
    .replace(/\{host\}/g, host);
}

export function resolvePrompt(promptTemplate: string, values: PlaceholderValues): string {
  return fillPlaceholders(promptTemplate, values);
}

export function resolveTitle(chrome: TerminalWindowChrome, values: PlaceholderValues): string {
  const text = chrome.titleBarText ?? '';
  if (PLACEHOLDER_RE.test(text)) return fillPlaceholders(text, values);
  if (chrome.titleBarCwd === 'none') return text;

  const dir = formatCwd(values.cwd, chrome.titleBarCwd);
  return text ? `${text}${chrome.titleBarSeparator}${dir}` : dir;
}

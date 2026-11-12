import type React from 'react';
import type { TerminalTheme, TerminalWindowChrome } from './types';
import type { ResolvedTerminalTheme } from './resolve';

export function makeWindowStyle(theme: TerminalTheme, chrome: TerminalWindowChrome | null): React.CSSProperties {
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

export const styles = {
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

export function makePromptStyle(theme: TerminalTheme): React.CSSProperties {
  return {
    color: theme.promptColor,
    paddingRight: 6,
    whiteSpace: 'pre',
    wordBreak: 'normal',
    userSelect: 'none',
  };
}

export function makeCursorStyle(
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

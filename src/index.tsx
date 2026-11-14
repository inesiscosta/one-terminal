import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { TerminalProps } from './types';
import { useTerminalEngine } from './hooks';
import { useCaret } from './useCaret';
import { useDemo } from './useDemo';
import { useKeyboard } from './useKeyboard';
import { WindowChrome } from './WindowChrome';
import { makeCursorStyle, makePromptStyle, makeWindowStyle, styles } from './styles';
import {
  adaptChromeToBackground,
  DEFAULT_CHROME_STYLE,
  DEFAULT_FILE_STRUCTURE,
  DEFAULT_HOSTNAME,
  DEFAULT_PROMPT,
  DEFAULT_SHELL_NAME,
  DEFAULT_START_PATH,
  DEFAULT_THEME,
  DEFAULT_USERNAME,
  DEFAULT_WELCOME_MESSAGE,
  resolveChrome,
  resolvePrompt,
  resolveTheme,
  resolveTitle,
} from './resolve';

export * from './types';

export const Terminal: React.FC<Partial<TerminalProps>> = ({
  fileStructure: fs = DEFAULT_FILE_STRUCTURE,
  startPath = DEFAULT_START_PATH,
  welcomeMessage = DEFAULT_WELCOME_MESSAGE,
  prompt = DEFAULT_PROMPT,
  username = DEFAULT_USERNAME,
  hostname = DEFAULT_HOSTNAME,
  shellName = DEFAULT_SHELL_NAME,
  neofetch,
  windowChrome = DEFAULT_CHROME_STYLE,
  theme = DEFAULT_THEME,
  extraCommands,
  className,
  demo,
  style,
}) => {
  const resolvedTheme = useMemo(() => resolveTheme(theme), [theme]);
  const chrome = useMemo(
    () => adaptChromeToBackground(resolveChrome(windowChrome), resolvedTheme.backgroundColor),
    [windowChrome, resolvedTheme.backgroundColor],
  );

  const engine = useTerminalEngine({
    fs,
    startPath,
    extraCommands,
    username,
    hostname,
    shellName,
    neofetch,
    accentColor: resolvedTheme.promptColor,
  });
  const { state } = engine;

  const placeholders = { cwd: state.path, user: username, host: hostname };
  const currentPrompt = resolvePrompt(prompt, placeholders);
  const title = chrome ? resolveTitle(chrome, placeholders) : '';

  const [showBanner, setShowBanner] = useState(!!welcomeMessage);

  // `clear` / Ctrl+L also remove the welcome message
  useEffect(() => {
    if (state.clearCount) setShowBanner(false);
  }, [state.clearCount]);

  const caret = useCaret({
    input: state.input,
    searchCaret: state.search
      ? {
          text: state.searchMatch,
          index: Math.max(0, state.search.query ? state.searchMatch.indexOf(state.search.query) : 0),
        }
      : null,
    busy: state.busy,
    blink: resolvedTheme.cursor.blink,
    blinkRate: resolvedTheme.cursor.blinkRate,
  });

  const demoPhase = useDemo(demo, {
    setInput: engine.setInput,
    setHistory: engine.setHistory,
    submit: () => engine.submit(currentPrompt),
    onType: () => {
      caret.markTyping();
      caret.syncSoon();
    },
    onRestart: () => setShowBanner(false),
  });
  const inputDisabled =
    demoPhase === 'running' || (demoPhase === 'finished' && (demo?.behavior ?? 'freeze') === 'freeze');

  const keyboard = useKeyboard({ engine, caret, prompt: currentPrompt, disabled: inputDisabled });

  // Keep the newest output in view
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [state.history, state.completion, state.search, state.busy]);

  const windowStyle = useMemo(() => makeWindowStyle(resolvedTheme, chrome), [resolvedTheme, chrome]);
  const promptStyle = useMemo(() => makePromptStyle(resolvedTheme), [resolvedTheme]);
  const cursorStyle = useMemo(
    () => makeCursorStyle(resolvedTheme, caret.offset, caret.visible),
    [resolvedTheme, caret.offset, caret.visible],
  );

  const searchLabel = state.search
    ? `(${state.search.failed ? 'failed ' : ''}${state.search.direction === 'reverse' ? 'reverse-' : ''}i-search)\`${state.search.query}': `
    : null;
  const shownLine = state.search ? state.searchMatch : state.busy ? '' : state.input;

  return (
    <div
      className={className ?? ''}
      style={{ width: '100%', height: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column', ...style }}
    >
      <div style={{ ...windowStyle, width: '100%', height: '100%', flex: '1 1 auto', minHeight: 0 }}>
        {chrome && <WindowChrome chrome={chrome} title={title} />}

        <div
          ref={bodyRef}
          style={styles.body}
          tabIndex={-1}
          onFocus={() => {
            caret.inputRef.current?.focus();
            caret.syncSoon();
          }}
        >
          {/* Screen readers announce new output as it's added */}
          <div role="log" aria-live="polite" aria-label="Terminal output" style={styles.row}>
            {showBanner && welcomeMessage && <div style={styles.historyLine}>{welcomeMessage}</div>}

            {state.history.map((entry, index) => (
              <div key={entry.id != null ? `id-${entry.id}` : `i-${index}`}>
                {!entry.hideInput && (
                  <div style={styles.historyLine}>
                    <span style={promptStyle}>{entry.in ? entry.prompt || currentPrompt : currentPrompt}</span>
                    {entry.in}
                  </div>
                )}
                {entry.out && <div style={styles.historyLine}>{entry.out}</div>}
              </div>
            ))}
          </div>

          <div style={styles.inputRow}>
            {searchLabel !== null ? (
              <span style={{ ...promptStyle, color: 'inherit' }}>{searchLabel}</span>
            ) : (
              !state.busy && (
                <span style={promptStyle} aria-hidden>
                  {currentPrompt}
                </span>
              )
            )}
            <span style={styles.inputContainer}>
              <span style={styles.inputText} aria-hidden>
                {shownLine || ' '}
              </span>
              <span ref={caret.measurerRef} style={styles.realCaret} aria-hidden />
              <span style={cursorStyle} aria-hidden />
              <input
                ref={caret.inputRef}
                style={styles.hiddenInput}
                value={state.input}
                disabled={inputDisabled}
                aria-label={`Terminal input, ${currentPrompt.trim()}`}
                onChange={(e) => {
                  if (state.busy || state.search) return;
                  engine.setInput(e.target.value);
                  caret.markTyping();
                  caret.syncSoon();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onPaste={keyboard.onPaste}
                onKeyDown={keyboard.onKeyDown}
                onKeyUp={caret.syncSoon}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
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

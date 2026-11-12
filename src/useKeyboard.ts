import type React from 'react';
import { useRef } from 'react';
import type { useTerminalEngine } from './hooks';
import { ALT_EDITS, CTRL_EDITS, insertText, type LineEditFn } from './lineEditing';
import type { useCaret } from './useCaret';

type Engine = ReturnType<typeof useTerminalEngine>;
type Caret = ReturnType<typeof useCaret>;

type KeyboardOptions = {
  engine: Engine;
  caret: Caret;
  /** The prompt to record with each submitted line. */
  prompt: string;
  /** True while a demo owns the terminal. */
  disabled: boolean;
};

const MODIFIER_KEYS = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'];

/** Maps key presses to engine actions and readline-style line edits. */
export function useKeyboard({ engine, caret, prompt, disabled }: KeyboardOptions) {
  const { state } = engine;

  // Text removed by Ctrl+U/K/W and Alt+D/Backspace, pasted back with Ctrl+Y
  const killRingRef = useRef('');

  /** Applies a line edit at the current selection. */
  const edit = (fn: LineEditFn) => {
    const el = caret.inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? state.input.length;
    const result = fn({ value: state.input, start, end: el.selectionEnd ?? start });

    if (result.killed) killRingRef.current = result.killed;
    if (result.value !== state.input) {
      caret.setCaretAfterRender(result.caret);
      engine.setInput(result.value);
    } else {
      caret.setCaretNow(result.caret);
    }
  };

  /** Ctrl+<key> actions that aren't simple line edits. */
  const ctrlActions: Record<string, () => void> = {
    c: () => engine.interrupt(prompt),
    l: () => engine.clearScreen(),
    i: () => engine.complete(),
    p: () => engine.navigateHistory('up'),
    n: () => engine.navigateHistory('down'),
    r: () => engine.startSearch('reverse'),
    s: () => engine.startSearch('forward'),
    o: () => engine.operateAndGetNext(prompt),
    y: () => killRingRef.current && edit(insertText(killRingRef.current)),
  };

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, ctrlKey: string | null) => {
    const search = state.search!;
    event.preventDefault();

    if (ctrlKey === 'r') engine.startSearch('reverse');
    else if (ctrlKey === 's') engine.startSearch('forward');
    else if (ctrlKey === 'g') engine.cancelSearch();
    else if (ctrlKey === 'c') engine.interrupt(prompt);
    else if (ctrlKey === 'o') engine.operateAndGetNext(prompt);
    else if (ctrlKey === 'l') engine.clearScreen();
    else if (event.key === 'Enter') engine.submit(prompt, state.searchMatch);
    else if (event.key === 'Backspace' || ctrlKey === 'h') engine.setSearchQuery(search.query.slice(0, -1));
    else if (event.key.length === 1 && !ctrlKey && !event.metaKey && !event.altKey) {
      engine.setSearchQuery(search.query + event.key);
    } else if (!MODIFIER_KEYS.includes(event.key)) {
      // Anything else (Esc, arrows, Tab...) leaves search keeping the match on the line
      engine.acceptSearch();
    }
    caret.syncSoon();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    caret.markTyping();

    const ctrlKey =
      event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey ? event.key.toLowerCase() : null;
    const altCode = event.altKey && !event.ctrlKey && !event.metaKey ? event.code : null;

    // Let Ctrl+C copy when there is selected text on the page
    if (ctrlKey === 'c' && window.getSelection()?.toString()) return;

    // A command (e.g. sleep) is running: only Ctrl+C and Ctrl+L do anything
    if (state.busy) {
      if (event.key !== 'Shift' && !event.metaKey) event.preventDefault();
      if (ctrlKey === 'c') engine.interrupt(prompt);
      else if (ctrlKey === 'l') engine.clearScreen();
      return;
    }

    if (state.search) {
      onSearchKeyDown(event, ctrlKey);
      return;
    }

    let handled = true;
    if (ctrlKey && CTRL_EDITS[ctrlKey]) edit(CTRL_EDITS[ctrlKey]);
    else if (ctrlKey && ctrlActions[ctrlKey]) ctrlActions[ctrlKey]();
    else if (altCode && ALT_EDITS[altCode]) edit(ALT_EDITS[altCode]);
    else if (altCode === 'Period') {
      const arg = engine.getLastArgument();
      if (arg) edit(insertText(arg));
    } else if (event.key === 'Enter') engine.submit(prompt);
    else if (event.key === 'Tab') engine.complete();
    else if (event.key === 'ArrowUp') engine.navigateHistory('up');
    else if (event.key === 'ArrowDown') engine.navigateHistory('down');
    else handled = false; // Typing, arrows left/right, and browser shortcuts proceed as usual

    if (handled) event.preventDefault();
    caret.syncSoon();
  };

  /** Pasting while searching history extends the search query. */
  const onPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    if (!state.search) return;
    event.preventDefault();
    engine.setSearchQuery(state.search.query + event.clipboardData.getData('text').replace(/\s+/g, ' '));
  };

  return { onKeyDown, onPaste };
}

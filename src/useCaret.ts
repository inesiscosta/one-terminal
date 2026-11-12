import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// useLayoutEffect warns during SSR on React 18, so fall back to useEffect on the server
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

type CaretOptions = {
  /** The line being edited. */
  input: string;
  /** While searching history, the cursor sits on the match instead of the input. */
  searchCaret: { text: string; index: number } | null;
  /** Re-measure when these change. */
  busy: boolean;
  blink: boolean;
  blinkRate: number;
};

/**
 * Draws a fake cursor over a hidden <input>: measures where the caret is, makes it blink
 * (but not while typing), and restores the caret position after programmatic edits.
 */
export function useCaret({ input, searchCaret, busy, blink, blinkRate }: CaretOptions) {
  const inputRef = useRef<HTMLInputElement>(null);
  const measurerRef = useRef<HTMLSpanElement>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const typingTimerRef = useRef(0);
  const searchCaretRef = useRef(searchCaret);
  searchCaretRef.current = searchCaret;

  const [offset, setOffset] = useState(0);
  const [visible, setVisible] = useState(true);
  const [typing, setTyping] = useState(false);

  /** Measures the text before the caret and moves the fake cursor there. */
  const sync = useCallback(() => {
    const el = inputRef.current;
    const measurer = measurerRef.current;
    if (!el || !measurer) return;

    const search = searchCaretRef.current;
    const value = search ? search.text : el.value;
    const caret = search ? search.index : (el.selectionStart ?? value.length);

    if (caret === 0) {
      measurer.textContent = '';
      setOffset(0);
      return;
    }
    measurer.textContent = value.slice(0, caret) || ' ';
    setOffset(measurer.getBoundingClientRect().width);
  }, []);

  /** Syncs on the next frame, after the browser has applied the key press. */
  const syncSoon = useCallback(() => {
    requestAnimationFrame(sync);
  }, [sync]);

  /** Keeps the cursor solid while typing. */
  const markTyping = useCallback(() => {
    setTyping(true);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => setTyping(false), blinkRate);
  }, [blinkRate]);

  /**
   * Puts the caret at `caret` once React has re-rendered the input with a new value
   * (setting it earlier would be undone when the controlled value changes).
   */
  const setCaretAfterRender = useCallback((caret: number) => {
    pendingCaretRef.current = caret;
  }, []);

  /** Moves the caret now, for edits that don't change the text. */
  const setCaretNow = useCallback(
    (caret: number) => {
      inputRef.current?.setSelectionRange(caret, caret);
      sync();
    },
    [sync],
  );

  useIsomorphicLayoutEffect(() => {
    const caret = pendingCaretRef.current;
    if (caret === null || !inputRef.current) return;
    pendingCaretRef.current = null;
    inputRef.current.setSelectionRange(caret, caret);
    sync();
  });

  useEffect(() => () => clearTimeout(typingTimerRef.current), []);

  // Re-measure when the line changes from outside (submit, history, completion...)
  useEffect(() => {
    sync();
  }, [sync, input, searchCaret?.text, searchCaret?.index, busy]);

  useEffect(() => {
    if (!blink || typing) {
      setVisible(true);
      return;
    }
    const id = window.setInterval(() => setVisible((v) => !v), blinkRate);
    return () => window.clearInterval(id);
  }, [typing, blink, blinkRate]);

  return { inputRef, measurerRef, offset, visible, sync, syncSoon, markTyping, setCaretAfterRender, setCaretNow };
}

// Pure readline-style edits. Each takes the line and selection and returns the new line and caret.

export type LineState = { value: string; start: number; end: number };
export type LineEdit = { value: string; caret: number; /** Text cut into the kill ring */ killed?: string };
export type LineEditFn = (line: LineState) => LineEdit;

const isWordChar = (ch: string | undefined) => !!ch && /[A-Za-z0-9]/.test(ch);

/** Start of the alphanumeric word before `i` (Alt+B). */
export function wordStart(value: string, i: number): number {
  while (i > 0 && !isWordChar(value[i - 1])) i--;
  while (i > 0 && isWordChar(value[i - 1])) i--;
  return i;
}

/** End of the alphanumeric word after `i` (Alt+F). */
export function wordEnd(value: string, i: number): number {
  while (i < value.length && !isWordChar(value[i])) i++;
  while (i < value.length && isWordChar(value[i])) i++;
  return i;
}

/** Start of the whitespace-delimited word before `i` (Ctrl+W). */
export function bigWordStart(value: string, i: number): number {
  while (i > 0 && /\s/.test(value[i - 1])) i--;
  while (i > 0 && !/\s/.test(value[i - 1])) i--;
  return i;
}

const moveTo = (value: string, caret: number): LineEdit => ({ value, caret });

const remove = (value: string, from: number, to: number): LineEdit => ({
  value: value.slice(0, from) + value.slice(to),
  caret: from,
});

const kill = (value: string, from: number, to: number): LineEdit => ({
  ...remove(value, from, to),
  killed: to > from ? value.slice(from, to) : undefined,
});

export const lineEdits = {
  toStart: ({ value }) => moveTo(value, 0),
  toEnd: ({ value }) => moveTo(value, value.length),
  back: ({ value, start }) => moveTo(value, Math.max(0, start - 1)),
  forward: ({ value, start }) => moveTo(value, Math.min(value.length, start + 1)),
  wordBack: ({ value, start }) => moveTo(value, wordStart(value, start)),
  wordForward: ({ value, start }) => moveTo(value, wordEnd(value, start)),

  deleteBackward: ({ value, start, end }) =>
    start !== end ? remove(value, start, end) : start > 0 ? remove(value, start - 1, start) : moveTo(value, 0),
  deleteForward: ({ value, start, end }) => remove(value, start, start !== end ? end : start + 1),

  killToStart: ({ value, start }) => kill(value, 0, start),
  killToEnd: ({ value, start }) => kill(value, start, value.length),
  killBigWordBack: ({ value, start }) => kill(value, bigWordStart(value, start), start),
  killWordBack: ({ value, start }) => kill(value, wordStart(value, start), start),
  killWordForward: ({ value, start }) => kill(value, start, wordEnd(value, start)),

  /** Swaps the two characters before the cursor (at the end of the line, the last two). */
  transpose: ({ value, start }) => {
    if (value.length < 2 || start === 0) return moveTo(value, start);
    const at = start === value.length ? start - 1 : start;
    return moveTo(value.slice(0, at - 1) + value[at] + value[at - 1] + value.slice(at + 1), at + 1);
  },
} satisfies Record<string, LineEditFn>;

/** Inserts text over the selection (Ctrl+Y, Alt+.). */
export const insertText =
  (text: string): LineEditFn =>
  ({ value, start, end }) =>
    moveTo(value.slice(0, start) + text + value.slice(end), start + text.length);

/** Ctrl+<key> line edits. */
export const CTRL_EDITS: Record<string, LineEditFn> = {
  a: lineEdits.toStart,
  e: lineEdits.toEnd,
  b: lineEdits.back,
  f: lineEdits.forward,
  h: lineEdits.deleteBackward,
  d: lineEdits.deleteForward,
  u: lineEdits.killToStart,
  k: lineEdits.killToEnd,
  w: lineEdits.killBigWordBack,
  t: lineEdits.transpose,
};

/** Alt+<key> line edits, keyed by `KeyboardEvent.code` (Option+key types symbols on macOS). */
export const ALT_EDITS: Record<string, LineEditFn> = {
  KeyB: lineEdits.wordBack,
  KeyF: lineEdits.wordForward,
  KeyD: lineEdits.killWordForward,
  Backspace: lineEdits.killWordBack,
};

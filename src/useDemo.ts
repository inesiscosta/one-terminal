import { useEffect, useRef, useState } from 'react';
import type { HistoryEntry, TerminalDemoConfig } from './types';

export type DemoPhase = 'idle' | 'running' | 'finished';

type DemoControls = {
  setInput: (update: string | ((prev: string) => string)) => void;
  setHistory: (history: HistoryEntry[]) => void;
  /** Runs the current line. Read on every call, so the demo always uses the latest prompt. */
  submit: () => void;
  /** Called before every keystroke the demo types. */
  onType: () => void;
  /** Called when a looping demo starts over. */
  onRestart: () => void;
};

/** Types and runs `demo.script` line by line. Restarts when the script changes. */
export function useDemo(demo: TerminalDemoConfig | undefined, controls: DemoControls): DemoPhase {
  const [phase, setPhase] = useState<DemoPhase>('idle');

  // Latest callbacks, so the long-running script never calls stale ones
  const controlsRef = useRef(controls);
  controlsRef.current = controls;

  useEffect(() => {
    if (!demo?.script?.length) {
      setPhase('idle');
      return;
    }

    // Each run gets its own cancel token so a restarted demo can't be resumed by an old one
    const run = { cancelled: false };
    const timers: number[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, ms));
      });
    const c = () => controlsRef.current;

    const defaultCharDelay = demo.defaultCharDelayMs ?? 40;
    const defaultAfterDelay = demo.defaultAfterLineDelayMs ?? 600;
    const behavior = demo.behavior ?? 'freeze';
    const loopDelay = demo.loopDelayMs ?? 800;

    const type = async (update: (prev: string) => string, delay: number) => {
      await wait(delay);
      if (run.cancelled) return;
      c().setInput(update);
      c().onType();
    };

    const runOnce = async () => {
      for (const step of demo.script) {
        if (run.cancelled) return;
        const { line, charDelayMs, afterLineDelayMs } = typeof step === 'string' ? { line: step } : step;
        const charDelay = charDelayMs ?? defaultCharDelay;
        const afterDelay = afterLineDelayMs ?? defaultAfterDelay;

        c().setInput('');
        c().onType();
        for (const ch of line) await type((prev) => prev + ch, charDelay);

        // Let the last character settle in state before running/deleting
        await wait(charDelay);
        if (run.cancelled) return;

        if (demo.mode === 'type-writer') {
          await wait(afterDelay);
          for (let i = 0; i < line.length; i++) await type((prev) => prev.slice(0, -1), charDelay);
        } else {
          c().submit();
          await wait(afterDelay);
        }

        await wait(10);
      }
    };

    const runDemo = async () => {
      setPhase('running');
      if (behavior === 'loop') {
        while (!run.cancelled) {
          c().setHistory([]);
          c().onRestart();
          await runOnce();
          await wait(loopDelay);
        }
      } else {
        await runOnce();
        if (!run.cancelled) setPhase('finished');
      }
    };

    runDemo();

    return () => {
      run.cancelled = true;
      timers.forEach((id) => clearTimeout(id));
    };
  }, [
    demo?.script,
    demo?.behavior,
    demo?.mode,
    demo?.defaultCharDelayMs,
    demo?.defaultAfterLineDelayMs,
    demo?.loopDelayMs,
  ]);

  return phase;
}

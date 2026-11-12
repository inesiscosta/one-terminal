'use client';

import { Terminal, type DirectoryNode } from 'one-terminal';
import type { ComponentProps, ReactNode } from 'react';
import { sampleFiles } from './sampleFiles';

type LiveTerminalProps = Partial<ComponentProps<typeof Terminal>> & {
  /** Height of the terminal in px. */
  height?: number;
  /** Short hint shown under the terminal, e.g. what to type. */
  hint?: ReactNode;
};

/** A working terminal embedded in the docs, with a sample file system by default. */
export function LiveTerminal({ height = 320, hint, fileStructure, ...props }: LiveTerminalProps) {
  return (
    <figure className="not-prose my-6">
      <div style={{ height }} className="overflow-hidden rounded-xl shadow-lg">
        <Terminal fileStructure={fileStructure ?? (sampleFiles as DirectoryNode)} {...props} />
      </div>
      {hint && <figcaption className="mt-2 text-sm text-gray-500 dark:text-gray-400">{hint}</figcaption>}
    </figure>
  );
}

// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Terminal } from './index';
import type { DirectoryNode } from './types';

const files: DirectoryNode = {
  kind: 'directory',
  entries: {
    'about.txt': { kind: 'file', fileType: 'text', content: 'Hello there' },
    projects: {
      kind: 'directory',
      entries: { 'one.md': { kind: 'file', fileType: 'text', content: '# One' } },
    },
  },
};

afterEach(cleanup);

function setup(props: Partial<React.ComponentProps<typeof Terminal>> = {}) {
  const user = userEvent.setup();
  render(<Terminal fileStructure={files} {...props} />);
  const input = screen.getByRole('textbox');
  const output = screen.getByRole('log');
  const run = async (line: string) => {
    await user.type(input, line);
    await user.keyboard('{Enter}');
  };
  return { user, input, output, run };
}

describe('<Terminal />', () => {
  it('runs commands and shows their output', async () => {
    const { output, run } = setup();
    await run('cat about.txt');
    expect(output).toHaveTextContent('guest@~:$ cat about.txt');
    expect(output).toHaveTextContent('Hello there');
  });

  it('keeps the prompt in sync with cd and updates the title', async () => {
    const { input, run } = setup();
    await run('cd projects');
    expect(input).toHaveAccessibleName('Terminal input, guest@projects:$');
    expect(screen.getByText('projects', { selector: 'div' })).toBeInTheDocument();
  });

  it('completes paths with Tab', async () => {
    const { user, input } = setup();
    await user.type(input, 'cd pro');
    await user.keyboard('{Tab}');
    expect(input).toHaveValue('cd projects/');
  });

  it('recalls history with the arrow keys', async () => {
    const { user, input, run } = setup();
    await run('pwd');
    await user.keyboard('{ArrowUp}');
    expect(input).toHaveValue('pwd');
  });

  it('cancels the line with Ctrl+C', async () => {
    const { user, input, output } = setup();
    await user.type(input, 'half typed');
    await user.keyboard('{Control>}c{/Control}');
    expect(input).toHaveValue('');
    expect(output).toHaveTextContent('half typed^C');
  });

  it('clears the screen and the welcome message with Ctrl+L, keeping the line', async () => {
    const { user, input, output, run } = setup({ welcomeMessage: 'Welcome!' });
    expect(output).toHaveTextContent('Welcome!');
    await run('pwd');
    await user.type(input, 'ls');
    await user.keyboard('{Control>}l{/Control}');
    expect(output).toBeEmptyDOMElement();
    expect(input).toHaveValue('ls');
  });

  it('edits the line with readline shortcuts', async () => {
    const { user, input } = setup();
    await user.type(input, 'echo hello world');
    await user.keyboard('{Control>}w{/Control}'); // cut "world"
    expect(input).toHaveValue('echo hello ');
    await user.keyboard('{Control>}a{/Control}{Control>}y{/Control}'); // paste it at the start
    expect(input).toHaveValue('worldecho hello ');
    await user.keyboard('{Control>}u{/Control}'); // the cursor is after "world": cut it again
    expect(input).toHaveValue('echo hello ');
  });

  it('searches history with Ctrl+R and runs the match', async () => {
    const { user, input, output, run } = setup();
    await run('echo alpha');
    await run('pwd');
    await user.keyboard('{Control>}r{/Control}');
    await user.keyboard('alp');
    expect(screen.getByText(/\(reverse-i-search\)`alp':/)).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(output.textContent?.match(/alpha/g)).toHaveLength(4); // 2 commands + 2 outputs
    expect(input).toHaveValue('');
  });

  it('runs extra commands with parsed arguments and piped input', async () => {
    const greet = vi.fn((args: string[]) => `Hi ${args.join('|')}`);
    const { output, run } = setup({
      extraCommands: {
        greet: { run: greet },
        upper: { run: (_args, ctx) => ctx.stdin?.toUpperCase() },
      },
    });
    await run('greet "Jack Turner" -v');
    expect(greet).toHaveBeenCalledWith(['Jack Turner', '-v'], expect.any(Object));
    await run('cat about.txt | upper');
    expect(output).toHaveTextContent('HELLO THERE');
  });

  it('stops sleep with Ctrl+C', async () => {
    const { user, input, output, run } = setup();
    await run('sleep 60');
    expect(screen.queryByText('guest@~:$', { selector: '[aria-hidden]' })).not.toBeInTheDocument();
    await user.keyboard('{Control>}c{/Control}');
    expect(output).toHaveTextContent('sleep 60^C');
    expect(input).toHaveAccessibleName('Terminal input, guest@~:$');
  });

  it('runs pipeline stages without changing the session, like subshells', async () => {
    const { input, output, run } = setup();
    await run('cd projects | cat');
    expect(input).toHaveAccessibleName('Terminal input, guest@~:$');
    await run('clear | cat');
    expect(output).toHaveTextContent('cd projects | cat');
    await run('history -c | cat');
    await run('history');
    expect(output).toHaveTextContent('1 cd projects | cat');
  });

  describe('async commands', () => {
    function deferred<T>() {
      let resolve!: (value: T) => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    }

    it('shows the output when the promise resolves, hiding the prompt meanwhile', async () => {
      const pending = deferred<string>();
      const { input, output, run } = setup({ extraCommands: { stars: { run: () => pending.promise } } });
      await run('stars');
      expect(output).toHaveTextContent('guest@~:$ stars');
      expect(screen.queryByText('guest@~:$', { selector: '[aria-hidden]' })).not.toBeInTheDocument();
      await act(async () => pending.resolve('42 stars'));
      expect(output).toHaveTextContent('stars42 stars');
      expect(input).toHaveAccessibleName('Terminal input, guest@~:$');
    });

    it('aborts with Ctrl+C and ignores a late result', async () => {
      const pending = deferred<string>();
      let signal: AbortSignal | undefined;
      const { user, output, run } = setup({
        extraCommands: {
          slow: {
            run: (_args, ctx) => {
              signal = ctx.signal;
              return pending.promise;
            },
          },
        },
      });
      await run('slow');
      await user.keyboard('{Control>}c{/Control}');
      expect(signal?.aborted).toBe(true);
      expect(output).toHaveTextContent('slow^C');
      await act(async () => pending.resolve('too late'));
      expect(output).not.toHaveTextContent('too late');
    });

    it('works inside pipelines', async () => {
      const { output, run } = setup({
        extraCommands: {
          later: { run: async (args) => args.join(' ') },
          shout: { run: async (_args, ctx) => ctx.stdin?.toUpperCase() },
        },
      });
      await run('later hello async world | shout | wc -w');
      await waitFor(() => expect(output).toHaveTextContent(/wc -w\s+3$/));
      await run('cat about.txt | shout');
      await waitFor(() => expect(output).toHaveTextContent('HELLO THERE'));
    });

    it('reports a rejected promise', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const { output, run } = setup({ extraCommands: { broken: { run: () => Promise.reject(new Error('boom')) } } });
      await run('broken');
      await waitFor(() => expect(output).toHaveTextContent('error: executing broken'));
      vi.restoreAllMocks();
    });
  });

  describe('command lists and exit status', () => {
    it('runs && and || based on the previous status, and ; always', async () => {
      const { output, run } = setup();
      await run('true && echo yes || echo no');
      expect(output).toHaveTextContent(/yes$/);
      await run('false && echo yes || echo no');
      expect(output).toHaveTextContent(/no$/);
      await run('false; echo always');
      expect(output).toHaveTextContent(/always$/);
    });

    it('exposes the last status as $?', async () => {
      const { output, run } = setup();
      await run('nope; echo $?');
      expect(output).toHaveTextContent(/command not found: nope\s*127$/);
      await run('grep zzz about.txt; echo "status $?" \'$?\'');
      expect(output).toHaveTextContent(/status 1 \$\?$/);
    });

    it('lets cd affect the rest of the line', async () => {
      const { input, output, run } = setup();
      await run('cd projects && ls');
      expect(output).toHaveTextContent(/one\.md$/);
      expect(input).toHaveAccessibleName('Terminal input, guest@projects:$');
    });

    it('shows only what ran after clear', async () => {
      const { output, run } = setup();
      await run('pwd');
      await run('clear; echo fresh');
      expect(output).toHaveTextContent(/^fresh$/);
    });

    it('takes exit codes from custom commands', async () => {
      const { output, run } = setup({
        extraCommands: {
          check: { run: (args) => ({ output: `checked ${args[0]}`, exitCode: args[0] === 'ok' ? 0 : 3 }) },
        },
      });
      await run('check bad || echo "failed with $?"');
      expect(output).toHaveTextContent(/checked bad\s*failed with 3$/);
      await run('check ok && echo passed');
      expect(output).toHaveTextContent(/checked ok\s*passed$/);
    });

    it('waits for sleep before running the next command', async () => {
      const { output, run } = setup();
      await run('sleep 0.05 && echo woke');
      const wokeCount = () => output.textContent?.match(/woke/g)?.length;
      expect(wokeCount()).toBe(1); // just the command line
      await waitFor(() => expect(wokeCount()).toBe(2));
    });
  });

  it('prefixes shell errors with the shell name', async () => {
    const { output, run } = setup();
    await run('upper');
    expect(output).toHaveTextContent('zsh: command not found: upper');
    await run('echo "oops');
    expect(output).toHaveTextContent('zsh: unexpected EOF while looking for matching `"\'');
    await run('!99');
    expect(output).toHaveTextContent('zsh: !99: event not found');
  });

  it('uses a custom shellName in errors and neofetch', async () => {
    const { output, run } = setup({ shellName: 'bash' });
    await run('upper');
    expect(output).toHaveTextContent('bash: command not found: upper');
    await run('neofetch');
    expect(output).toHaveTextContent('Shell: bash');
  });

  it('types and runs a demo script, then hands over', async () => {
    render(
      <Terminal
        fileStructure={files}
        demo={{ script: ['pwd'], behavior: 'interactive', defaultCharDelayMs: 1, defaultAfterLineDelayMs: 1 }}
      />,
    );
    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
    await waitFor(() => expect(input).toBeEnabled());
    expect(screen.getByRole('log')).toHaveTextContent('guest@~:$ pwd/');
  });
});

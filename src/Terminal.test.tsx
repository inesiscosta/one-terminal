// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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

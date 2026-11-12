# One Terminal

A fake but convincing terminal for React. Visitors `cd` around a virtual file system you define, `cat` and `grep`
your files, pipe commands together, and run your own custom commands. Great for portfolios, landing pages and
easter eggs.

**[Website](https://one-terminal.inesiscosta.com) · [Docs](https://one-terminal.inesiscosta.com/docs)**

## Features

- **Zero dependencies.** About 16 KB gzipped, just React 18+. Works in the Next.js App Router out of the box.
- **Feels like a real shell.** Quotes, pipes, flags, `~` and relative paths, tab completion, `Ctrl+R` history
  search, `!!` and friends, and the readline shortcuts (`Ctrl+A/E/U/K/W/Y`…).
- **Useful built-ins.** `ls`, `cd`, `pwd`, `tree`, `cat`, `grep`, `head`, `tail`, `wc`, `nl`, `echo`, `whoami`,
  `neofetch`, `history`, `sleep`, `clear` and a proper `help`.
- **Themeable.** Five built-in themes, macOS / Windows / Linux window frames, custom cursors, and a title bar that
  follows the current directory.
- **Extensible.** Add commands that return text or React elements, read piped input, and complete file paths, or
  override any built-in.
- **Demo mode.** Script an intro that types itself.

## Install

```bash
npm install one-terminal
```

## Quick start

```tsx
import { Terminal, type DirectoryNode } from 'one-terminal';

const files: DirectoryNode = {
  kind: 'directory',
  entries: {
    'about.txt': { kind: 'file', fileType: 'text', content: "Hi! I'm a developer who loves terminals." },
    projects: {
      kind: 'directory',
      entries: {
        'one-terminal.md': { kind: 'file', fileType: 'text', content: '# One Terminal\nA React terminal.' },
      },
    },
    github: { kind: 'file', fileType: 'link', href: 'https://github.com' },
  },
};

export default function App() {
  return (
    <div style={{ height: 400 }}>
      <Terminal
        fileStructure={files}
        username="jack"
        theme="dracula"
        welcomeMessage="Type 'help' to get started."
        extraCommands={{
          hello: { description: 'Say hi', run: (args) => `Hello, ${args[0] ?? 'world'}!` },
        }}
      />
    </div>
  );
}
```

## Documentation

- [Getting started](https://one-terminal.inesiscosta.com/docs)
- [File system](https://one-terminal.inesiscosta.com/docs/file-system)
- [Commands & shell syntax](https://one-terminal.inesiscosta.com/docs/commands)
- [Keyboard shortcuts](https://one-terminal.inesiscosta.com/docs/keyboard-shortcuts)
- [Themes & window](https://one-terminal.inesiscosta.com/docs/customization)
- [Extra commands](https://one-terminal.inesiscosta.com/docs/extra-commands)
- [Portfolio example](https://one-terminal.inesiscosta.com/docs/portfolio-example)
- [API reference](https://one-terminal.inesiscosta.com/docs/api-reference)

## Contributing

Found something missing or broken? Feel free to [open an issue](https://github.com/inesiscosta/one-terminal/issues)
or, even better, a [pull request](https://github.com/inesiscosta/one-terminal/pulls).

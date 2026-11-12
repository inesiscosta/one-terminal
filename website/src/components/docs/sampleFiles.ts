import type { DirectoryNode } from 'one-terminal';

/** The file system used by the live examples in the docs. */
export const sampleFiles: DirectoryNode = {
  kind: 'directory',
  entries: {
    'about.md': {
      kind: 'file',
      fileType: 'text',
      content: "# Hi, I'm Jack\nSoftware engineer in Lisbon.\nI like compilers, terminals and good coffee.",
    },
    'skills.txt': {
      kind: 'file',
      fileType: 'text',
      content: 'TypeScript\nReact\nRust\nGo\nPostgreSQL\nrust-analyzer enjoyer',
    },
    projects: {
      kind: 'directory',
      entries: {
        'one-terminal.md': {
          kind: 'file',
          fileType: 'text',
          content: '# one-terminal\nA React terminal component.\nStack: TypeScript, React',
        },
        'tiny-db.md': {
          kind: 'file',
          fileType: 'text',
          content: '# tiny-db\nA toy database written in Rust.\nStack: Rust',
        },
        'my notes.txt': { kind: 'file', fileType: 'text', content: 'A file with a space in its name.' },
      },
    },
    links: {
      kind: 'directory',
      entries: {
        github: { kind: 'file', fileType: 'link', href: 'https://github.com/inesiscosta/one-terminal' },
      },
    },
    '.secret': { kind: 'file', fileType: 'text', content: 'You found the secret file 🎉' },
  },
};

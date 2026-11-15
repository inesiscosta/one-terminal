// Test page: renders the terminal from the source, so e2e tests always cover the current code.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Terminal, type DirectoryNode } from '../../src/index';

const files: DirectoryNode = {
  kind: 'directory',
  entries: {
    'about.txt': { kind: 'file', fileType: 'text', content: 'Hello from the e2e page' },
    projects: {
      kind: 'directory',
      entries: { 'one.md': { kind: 'file', fileType: 'text', content: '# One' } },
    },
  },
};

createRoot(document.getElementById('terminal')!).render(
  <Terminal fileStructure={files} welcomeMessage="Welcome to the e2e terminal" />,
);

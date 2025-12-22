[One Terminal](https://www.one-terminal.inesiscosta.com/) to rule them all! A lightweight, themeable terminal component for React.

## Usage

To start using the library, install it in your project:

```bash
npm install one-terminal
```

Define your virtual file system and add <Terminal> it to the page where you want your terminal to be rendered.
```jsx
import { Terminal } from "one-terminal";

// Define your virtual file system
const vfs = {
  kind: "directory",
  entries: {
    readme: {
      kind: "file",
      fileType: "text",
      content: "Welcome to One Terminal 👋",
    },
  },
} as const;

export default function App() {
  return <Terminal fileStructure={vfs} />;
}

```

## Documentation
Find the full API reference in the [documentation](https://www.one-terminal.inesiscosta.com/docs).

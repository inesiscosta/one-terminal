import { describe, expect, it } from 'vitest';
import { insertText, lineEdits, type LineEditFn } from './lineEditing';
import {
  adaptChromeToBackground,
  isLightColor,
  resolveChrome,
  resolvePrompt,
  resolveTheme,
  resolveTitle,
} from './resolve';
import { CHROME_STYLES } from './themes';

/** Applies an edit with the caret at `|` in `line`. */
function apply(fn: LineEditFn, line: string) {
  const caret = line.indexOf('|');
  const value = line.replace('|', '');
  const result = fn({ value, start: caret, end: caret });
  return { line: result.value.slice(0, result.caret) + '|' + result.value.slice(result.caret), killed: result.killed };
}

describe('line editing', () => {
  it('moves by character, word and line', () => {
    expect(apply(lineEdits.toStart, 'echo hi|').line).toBe('|echo hi');
    expect(apply(lineEdits.toEnd, '|echo hi').line).toBe('echo hi|');
    expect(apply(lineEdits.wordBack, 'cat my-file.txt|').line).toBe('cat my-file.|txt');
    expect(apply(lineEdits.wordForward, '|cat my-file').line).toBe('cat| my-file');
  });

  it('deletes and cuts', () => {
    expect(apply(lineEdits.deleteBackward, 'ab|c').line).toBe('a|c');
    expect(apply(lineEdits.deleteForward, 'ab|c').line).toBe('ab|');
    expect(apply(lineEdits.killToStart, 'echo |hi')).toEqual({ line: '|hi', killed: 'echo ' });
    expect(apply(lineEdits.killToEnd, 'echo |hi')).toEqual({ line: 'echo |', killed: 'hi' });
    expect(apply(lineEdits.killBigWordBack, 'cat my-file.txt|')).toEqual({ line: 'cat |', killed: 'my-file.txt' });
    expect(apply(lineEdits.killWordBack, 'cat my-file.txt|')).toEqual({ line: 'cat my-file.|', killed: 'txt' });
    expect(apply(lineEdits.killWordForward, 'cat| my file')).toEqual({ line: 'cat| file', killed: ' my' });
  });

  it('transposes and inserts', () => {
    expect(apply(lineEdits.transpose, 'gerp|').line).toBe('gepr|');
    expect(apply(lineEdits.transpose, 'gr|ep').line).toBe('ger|p');
    expect(apply(insertText('world'), 'hello |').line).toBe('hello world|');
  });

  it('does nothing at the edges', () => {
    expect(apply(lineEdits.deleteBackward, '|abc').line).toBe('|abc');
    expect(apply(lineEdits.killToStart, '|abc').killed).toBeUndefined();
  });
});

describe('resolving props', () => {
  it('merges theme presets with overrides', () => {
    const theme = resolveTheme(['monokai', { fontSize: '20px', cursor: { color: 'red' } }]);
    expect(theme.backgroundColor).toBe('#272822');
    expect(theme.fontSize).toBe('20px');
    expect(theme.cursor).toMatchObject({ shape: 'beam', color: 'red' });
  });

  it('resolves window chrome and adapts it to light backgrounds', () => {
    expect(resolveChrome('none')).toBeNull();
    const linux = resolveChrome(['linux', { cornerRadius: 0 }])!;
    expect(linux).toMatchObject({ style: 'linux', cornerRadius: 0, titleBarCwd: 'basename' });
    expect(adaptChromeToBackground(linux, '#ffffff')!.titleBarTextColor).toBe('rgba(0, 0, 0, 0.7)');
    expect(adaptChromeToBackground(linux, '#000000')).toBe(linux);
  });

  it('detects light colors', () => {
    expect(isLightColor('#fdf6e3')).toBe(true);
    expect(isLightColor('#282a36')).toBe(false);
    expect(isLightColor('rgb(250, 250, 250)')).toBe(true);
  });

  it('fills prompt placeholders', () => {
    const values = { cwd: '/work/projects', user: 'jack', host: 'box' };
    expect(resolvePrompt('{user}@{host}:{path}$ ', values)).toBe('jack@box:~/work/projects$ ');
    expect(resolvePrompt('[{cwd}] ', { ...values, cwd: '/' })).toBe('[~] ');
  });

  it('builds the title from text, the directory and placeholders', () => {
    const values = { cwd: '/work/projects', user: 'jack', host: 'box' };
    const mac = CHROME_STYLES.mac;
    expect(resolveTitle(mac, values)).toBe('projects');
    expect(resolveTitle({ ...mac, titleBarText: 'Me' }, values)).toBe('Me — projects');
    expect(resolveTitle({ ...mac, titleBarText: 'Me', titleBarCwd: 'full' }, values)).toBe('Me — ~/work/projects');
    expect(resolveTitle({ ...mac, titleBarText: 'Me', titleBarCwd: 'none' }, values)).toBe('Me');
    expect(resolveTitle({ ...mac, titleBarText: '{user}@{host}: {path}' }, values)).toBe('jack@box: ~/work/projects');
  });
});

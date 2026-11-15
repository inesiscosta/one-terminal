import { expect, test, type Page } from '@playwright/test';

// Real-browser checks for what jsdom can't verify: focus, where the drawn cursor sits,
// text selection and keyboard handling.

const input = (page: Page) => page.getByRole('textbox', { name: /^Terminal input/ });
const output = (page: Page) => page.getByRole('log', { name: 'Terminal output' });

/** Horizontal position of the drawn cursor, in px from the start of the line. */
const cursorLeft = (page: Page) =>
  page.locator('[data-cursor]').evaluate((el) => parseFloat(getComputedStyle(el).left));

/**
 * Where the cursor ends up once it stops moving. The drawn cursor follows the caret a frame
 * later, so measuring right after typing can catch it partway (e.g. after 4 of 5 letters).
 */
async function settledCursorLeft(page: Page): Promise<number> {
  let last = Number.NaN;
  await expect
    .poll(async () => {
      const now = await cursorLeft(page);
      const settled = now === last;
      last = now;
      return settled;
    })
    .toBe(true);
  return last;
}

async function run(page: Page, line: string) {
  await input(page).pressSequentially(line);
  await input(page).press('Enter');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(output(page)).toContainText('Welcome to the e2e terminal');
});

test('clicking anywhere in the terminal focuses the input', async ({ page }) => {
  await page.locator('#outside').click();
  await expect(input(page)).not.toBeFocused();
  await output(page).click();
  await expect(input(page)).toBeFocused();
});

test('runs commands typed with the real keyboard', async ({ page }) => {
  await input(page).click();
  await run(page, 'cat about.txt');
  await expect(output(page)).toContainText('Hello from the e2e page');
  await run(page, 'cd projects && pwd');
  await expect(output(page)).toContainText('/projects');
  await expect(input(page)).toHaveAccessibleName('Terminal input, guest@projects:$');
});

test('draws the cursor at the caret position', async ({ page }) => {
  await input(page).click();
  await expect.poll(() => cursorLeft(page)).toBe(0);

  await input(page).pressSequentially('hello');
  const charWidth = (await settledCursorLeft(page)) / 5;
  expect(charWidth).toBeGreaterThan(0);

  await input(page).press('ArrowLeft');
  await input(page).press('ArrowLeft');
  await expect.poll(() => cursorLeft(page)).toBeCloseTo(3 * charWidth, 0);

  await input(page).press('Control+a');
  await expect.poll(() => cursorLeft(page)).toBe(0);
  await input(page).press('Control+e');
  await expect.poll(() => cursorLeft(page)).toBeCloseTo(5 * charWidth, 0);
});

test('moves by word with Alt (Option on macOS)', async ({ page }) => {
  await input(page).click();
  await input(page).pressSequentially('echo hello world');
  const charWidth = (await settledCursorLeft(page)) / 'echo hello world'.length;
  expect(charWidth).toBeGreaterThan(0);

  await input(page).press('Alt+b');
  await expect.poll(() => cursorLeft(page)).toBeCloseTo('echo hello '.length * charWidth, 0);
  await input(page).press('Control+k');
  await expect(input(page)).toHaveValue('echo hello ');
  await input(page).press('Control+y');
  await expect(input(page)).toHaveValue('echo hello world');
});

test('completes paths with Tab', async ({ page }) => {
  await input(page).click();
  await input(page).pressSequentially('cd pro');
  await input(page).press('Tab');
  await expect(input(page)).toHaveValue('cd projects/');
  await expect(input(page)).toBeFocused();
});

test('searches history with Ctrl+R', async ({ page }) => {
  await input(page).click();
  await run(page, 'echo alpha');
  await run(page, 'pwd');
  await input(page).press('Control+r');
  await input(page).pressSequentially('alp');
  await expect(page.getByText("(reverse-i-search)`alp':")).toBeVisible();
  await input(page).press('Escape');
  await expect(input(page)).toHaveValue('echo alpha');
});

test('Ctrl+C cancels the line, but copies when output text is selected', async ({ page }) => {
  await input(page).click();
  await input(page).pressSequentially('half typed');
  await input(page).press('Control+c');
  await expect(output(page)).toContainText('half typed^C');

  await run(page, 'echo copy me');
  await input(page).pressSequentially('keep this');
  await page.getByText('copy me', { exact: true }).selectText();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toContain('copy me');
  await page.keyboard.press('Control+c');
  await expect(output(page)).not.toContainText('keep this^C');
});

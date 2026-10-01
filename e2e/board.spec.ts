import { expect, test } from '@playwright/test';
import { installFakeSupabase } from './fakeSupabase';

const columns = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'in-review', title: 'In Review' },
  { id: 'done', title: 'Done' },
].map((c, position) => ({ ...c, user_id: 'e2e-user', position, created_at: String(position) }));

const col = (page: import('@playwright/test').Page, id: string) => page.locator(`[data-column-id="${id}"]`);

test('add, drag, reload: changes persist', async ({ page }) => {
  await installFakeSupabase(page, { columns });
  await page.goto('/');

  // Create a card in Backlog.
  await col(page, 'backlog').getByRole('button', { name: /Add card/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Title').fill('Ship the release');
  await dialog.getByLabel('Assignee').fill('Ada');
  await dialog.getByLabel('Due Date').fill('2030-06-01');
  await dialog.getByRole('button', { name: 'Save' }).click();
  const card = col(page, 'backlog').getByRole('button', { name: /Ship the release/ });
  await expect(card).toBeVisible();

  // Drag it with the mouse into In Progress.
  const from = await card.boundingBox();
  const to = await col(page, 'in-progress').boundingBox();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(to!.x + to!.width / 2, to!.y + 120, { steps: 15 });
  await page.mouse.up();
  await expect(col(page, 'in-progress').getByRole('button', { name: /Ship the release/ })).toBeVisible();

  // A reload re-reads from the (fake) backend: the card is still where we left it.
  await page.reload();
  await expect(col(page, 'in-progress').getByRole('button', { name: /Ship the release/ })).toBeVisible();
  await expect(col(page, 'backlog').getByRole('button', { name: /Ship the release/ })).toHaveCount(0);
});

test('delete with undo', async ({ page }) => {
  await installFakeSupabase(page, {
    columns,
    cards: [
      { id: 'c1', user_id: 'e2e-user', title: 'Temporary', assignee: 'Bo', priority: 'Low', due_date: '2030-01-01', column_id: 'backlog', created_at: '1' },
    ],
  });
  await page.goto('/');
  const card = page.getByRole('button', { name: /Temporary/ });
  await card.focus();
  await page.keyboard.press('Delete');
  await expect(card).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: /Temporary/ })).toBeVisible();
});

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_COLUMNS } from '../constants';
import { db } from '../test/supabaseMock';
import { Board } from './Board';

vi.mock('../lib/supabaseClient', () => import('../test/supabaseMock'));

const cardRow = (id: string, title: string, extra: Record<string, unknown> = {}) => ({
  id,
  user_id: 'u1',
  title,
  assignee: 'Ada',
  priority: 'High',
  due_date: '2030-01-01',
  column_id: 'backlog',
  ...extra,
});

async function renderBoard(cards: ReturnType<typeof cardRow>[] = []) {
  db.seed('columns', DEFAULT_COLUMNS.map((c, position) => ({ ...c, user_id: 'u1', position })));
  db.seed('cards', cards);
  render(<Board userId="u1" userEmail="ada@example.com" />);
  await waitFor(() => expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'false'));
}

const column = (id: string) => within(document.querySelector<HTMLElement>(`[data-column-id="${id}"]`)!);
const cardButton = (title: RegExp) => screen.findByRole('button', { name: title });

beforeEach(() => db.reset());

describe('Board: creating cards', () => {
  it('adds a card to the column whose Add card button was used', async () => {
    const user = userEvent.setup();
    await renderBoard();
    await user.click(column('in-progress').getByRole('button', { name: /Add card/ }));
    await user.type(screen.getByLabelText('Title'), 'Ship it');
    await user.type(screen.getByLabelText('Assignee'), 'Bo');
    fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2030-03-03' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await column('in-progress').findByText('Ship it')).toBeInTheDocument();
    expect(db.tables.cards[0]).toMatchObject({ title: 'Ship it', column_id: 'in-progress', user_id: 'u1' });
  });

  it('shows an error toast when the insert fails', async () => {
    const user = userEvent.setup();
    await renderBoard();
    db.failNext('cards', 'insert');
    await user.click(column('backlog').getByRole('button', { name: /Add card/ }));
    await user.type(screen.getByLabelText('Title'), 'Doomed');
    await user.type(screen.getByLabelText('Assignee'), 'Bo');
    fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2030-03-03' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not add the card.');
    expect(screen.queryByText('Doomed')).not.toBeInTheDocument();
  });
});

describe('Board: editing cards', () => {
  it('opens a card with Enter, saves edits and persists them', async () => {
    const user = userEvent.setup();
    await renderBoard([cardRow('a', 'Old title')]);
    (await cardButton(/Old title/)).focus();
    await user.keyboard('{Enter}');
    const title = screen.getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'New title');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('New title')).toBeInTheDocument();
    expect(db.tables.cards[0].title).toBe('New title');
  });
});

describe('Board: moving cards', () => {
  it('moves a card with Shift+ArrowRight', async () => {
    const user = userEvent.setup();
    await renderBoard([cardRow('a', 'Mover')]);
    (await cardButton(/Mover/)).focus();
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(await column('in-progress').findByText('Mover')).toBeInTheDocument();
    expect(db.tables.cards[0].column_id).toBe('in-progress');
  });

  it('moves a card via the Column select in the edit modal', async () => {
    const user = userEvent.setup();
    await renderBoard([cardRow('a', 'Mover')]);
    (await cardButton(/Mover/)).focus();
    await user.keyboard('{Enter}');
    await user.selectOptions(screen.getByLabelText('Column'), 'in-review');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await column('in-review').findByText('Mover')).toBeInTheDocument();
    expect(db.tables.cards[0].column_id).toBe('in-review');
  });

  it('puts the card back and shows an error if the move fails', async () => {
    const user = userEvent.setup();
    await renderBoard([cardRow('a', 'Mover')]);
    (await cardButton(/Mover/)).focus();
    db.failNext('cards', 'update');
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not move the card.');
    expect(column('backlog').getByText('Mover')).toBeInTheDocument();
  });
});

describe('Board: deleting cards', () => {
  it('deletes from the modal and can undo', async () => {
    const user = userEvent.setup();
    await renderBoard([cardRow('a', 'Doomed')]);
    (await cardButton(/Doomed/)).focus();
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: 'Delete card' }));

    await waitFor(() => expect(screen.queryByText('Doomed')).not.toBeInTheDocument());
    expect(db.tables.cards).toHaveLength(0);

    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Doomed')).toBeInTheDocument();
    expect(db.tables.cards).toHaveLength(1);
  });

  it('deletes with the Delete key', async () => {
    const user = userEvent.setup();
    await renderBoard([cardRow('a', 'Doomed'), cardRow('b', 'Survivor')]);
    (await cardButton(/Doomed/)).focus();
    await user.keyboard('{Delete}');
    await waitFor(() => expect(screen.queryByText('Doomed')).not.toBeInTheDocument());
    expect(screen.getByText('Survivor')).toBeInTheDocument();
  });

  it('keeps the card and shows an error if delete fails', async () => {
    const user = userEvent.setup();
    await renderBoard([cardRow('a', 'Sticky')]);
    (await cardButton(/Sticky/)).focus();
    db.failNext('cards', 'delete');
    await user.keyboard('{Delete}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete the card.');
    expect(screen.getByText('Sticky')).toBeInTheDocument();
  });
});

describe('Board: filters', () => {
  it('filters by search text and priority, and clears', async () => {
    const user = userEvent.setup();
    await renderBoard([
      cardRow('a', 'Alpha task'),
      cardRow('b', 'Beta task', { priority: 'Low', assignee: 'Bo' }),
    ]);
    await screen.findByText('Alpha task');
    await user.type(screen.getByLabelText('Search cards by title or assignee'), 'beta');
    expect(screen.queryByText('Alpha task')).not.toBeInTheDocument();
    expect(screen.getByText('Beta task')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await user.selectOptions(screen.getByLabelText('Filter by priority'), 'High');
    expect(screen.getByText('Alpha task')).toBeInTheDocument();
    expect(screen.queryByText('Beta task')).not.toBeInTheDocument();
  });
});

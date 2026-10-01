import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../test/supabaseMock';
import { useCards } from './useCards';

vi.mock('../lib/supabaseClient', () => import('../test/supabaseMock'));

const row = (id: string, column_id = 'backlog') => ({
  id,
  user_id: 'u1',
  title: `Card ${id}`,
  assignee: 'Ada',
  priority: 'High',
  due_date: '2030-01-01',
  column_id,
});

const input = { title: 'New', assignee: 'Bo', priority: 'Low' as const, dueDate: '2030-02-02' };

async function setup(rows: ReturnType<typeof row>[] = []) {
  db.seed('cards', rows);
  const onError = vi.fn();
  const hook = renderHook(() => useCards('u1', onError));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return { ...hook, onError };
}

beforeEach(() => db.reset());

describe('useCards', () => {
  it('loads cards and maps snake_case rows to camelCase', async () => {
    const { result } = await setup([row('a', 'done')]);
    expect(result.current.cards).toEqual([
      { id: 'a', title: 'Card a', assignee: 'Ada', priority: 'High', dueDate: '2030-01-01', columnId: 'done' },
    ]);
  });

  it('reports a load failure', async () => {
    db.failNext('cards', 'select');
    const onError = vi.fn();
    const { result } = renderHook(() => useCards('u1', onError));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(onError).toHaveBeenCalledWith('Could not load your cards. Please refresh.');
  });

  it('creates a card owned by the user in the given column', async () => {
    const { result } = await setup();
    await act(() => result.current.addCard('in-progress', input));
    expect(result.current.cards).toHaveLength(1);
    expect(result.current.cards[0]).toMatchObject({ title: 'New', columnId: 'in-progress', dueDate: '2030-02-02' });
    expect(db.tables.cards[0]).toMatchObject({ user_id: 'u1', column_id: 'in-progress', due_date: '2030-02-02' });
  });

  it('does not add a card when the insert fails', async () => {
    const { result, onError } = await setup();
    db.failNext('cards', 'insert');
    await act(() => result.current.addCard('backlog', input));
    expect(result.current.cards).toHaveLength(0);
    expect(onError).toHaveBeenCalledWith('Could not add the card.');
  });

  it('edits a card and persists the change', async () => {
    const { result } = await setup([row('a')]);
    await act(() => result.current.updateCard('a', input));
    expect(result.current.cards[0]).toMatchObject({ title: 'New', assignee: 'Bo', priority: 'Low' });
    expect(db.tables.cards[0]).toMatchObject({ title: 'New', due_date: '2030-02-02' });
  });

  it('rolls back an edit when saving fails', async () => {
    const { result, onError } = await setup([row('a')]);
    db.failNext('cards', 'update');
    await act(() => result.current.updateCard('a', input));
    expect(result.current.cards[0].title).toBe('Card a');
    expect(onError).toHaveBeenCalledWith('Could not save your changes.');
  });

  it('moves a card to another column', async () => {
    const { result } = await setup([row('a')]);
    await act(() => result.current.moveCard('a', 'done'));
    expect(result.current.cards[0].columnId).toBe('done');
    expect(db.tables.cards[0].column_id).toBe('done');
  });

  it('rolls back a move when saving fails', async () => {
    const { result, onError } = await setup([row('a')]);
    db.failNext('cards', 'update');
    await act(() => result.current.moveCard('a', 'done'));
    expect(result.current.cards[0].columnId).toBe('backlog');
    expect(onError).toHaveBeenCalledWith('Could not move the card.');
  });

  it('moves several cards at once and ignores an empty list', async () => {
    const { result } = await setup([row('a'), row('b'), row('c')]);
    await act(() => result.current.moveCards(['a', 'b'], 'uncategorized'));
    expect(result.current.cards.map((c) => c.columnId)).toEqual(['uncategorized', 'uncategorized', 'backlog']);
    const callsBefore = db.calls.length;
    await act(() => result.current.moveCards([], 'done'));
    expect(db.calls).toHaveLength(callsBefore);
  });

  it('deletes a card and returns it for undo', async () => {
    const { result } = await setup([row('a'), row('b')]);
    let removed;
    await act(async () => {
      removed = await result.current.deleteCard('a');
    });
    expect(removed).toMatchObject({ id: 'a' });
    expect(result.current.cards.map((c) => c.id)).toEqual(['b']);
    expect(db.tables.cards.map((r) => r.id)).toEqual(['b']);
  });

  it('puts a card back in place when delete fails', async () => {
    const { result, onError } = await setup([row('a'), row('b')]);
    db.failNext('cards', 'delete');
    let removed;
    await act(async () => {
      removed = await result.current.deleteCard('a');
    });
    expect(removed).toBeUndefined();
    expect(result.current.cards.map((c) => c.id)).toEqual(['a', 'b']);
    expect(onError).toHaveBeenCalledWith('Could not delete the card.');
  });

  it('restores a deleted card in its original position', async () => {
    const { result } = await setup([row('a'), row('b')]);
    let removed;
    await act(async () => {
      removed = await result.current.deleteCard('a');
    });
    await act(() => result.current.restoreCards([removed!]));
    expect(result.current.cards.map((c) => c.id)).toEqual(['a', 'b']);
    expect(db.tables.cards.map((r) => r.id).sort()).toEqual(['a', 'b']);
  });
});

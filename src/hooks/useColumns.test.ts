import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_COLUMNS } from '../constants';
import { db } from '../test/supabaseMock';
import { useColumns } from './useColumns';

vi.mock('../lib/supabaseClient', () => import('../test/supabaseMock'));

async function setup(seed = true) {
  if (seed) db.seed('columns', DEFAULT_COLUMNS.map((c, position) => ({ ...c, user_id: 'u1', position })));
  const onError = vi.fn();
  const hook = renderHook(() => useColumns('u1', onError));
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return { ...hook, onError };
}

beforeEach(() => db.reset());

describe('useColumns', () => {
  it('seeds the default columns on first visit', async () => {
    const { result } = await setup(false);
    expect(result.current.columns).toEqual(DEFAULT_COLUMNS);
    expect(db.tables.columns).toHaveLength(DEFAULT_COLUMNS.length);
  });

  it('adds and renames a column, ignoring blank names', async () => {
    const { result } = await setup();
    await act(() => result.current.addColumn('  QA  '));
    expect(result.current.columns.at(-1)?.title).toBe('QA');
    const id = result.current.columns.at(-1)!.id;
    await act(() => result.current.renameColumn(id, ''));
    expect(result.current.columns.at(-1)?.title).toBe('QA');
    await act(() => result.current.renameColumn(id, 'Testing'));
    expect(result.current.columns.at(-1)?.title).toBe('Testing');
  });

  it('reorders columns and rolls back when saving fails', async () => {
    const { result, onError } = await setup();
    await act(async () => result.current.reorderColumn('done', 0));
    expect(result.current.columns[0].id).toBe('done');

    db.failNext('columns', 'upsert');
    await act(async () => result.current.reorderColumn('done', 3));
    expect(result.current.columns[0].id).toBe('done');
    expect(onError).toHaveBeenCalledWith('Could not save the column order.');
  });

  it('deletes a column and restores it at its old index', async () => {
    const { result } = await setup();
    let index: number | undefined;
    await act(async () => {
      index = await result.current.deleteColumn('in-review');
    });
    expect(index).toBe(2);
    expect(result.current.columns.map((c) => c.id)).not.toContain('in-review');
    await act(() => result.current.restoreColumn({ id: 'in-review', title: 'In Review' }, index!));
    expect(result.current.columns[2].id).toBe('in-review');
  });

  it('keeps the column when delete fails', async () => {
    const { result, onError } = await setup();
    db.failNext('columns', 'delete');
    await act(() => result.current.deleteColumn('done'));
    expect(result.current.columns).toHaveLength(4);
    expect(onError).toHaveBeenCalledWith('Could not delete the column.');
  });
});

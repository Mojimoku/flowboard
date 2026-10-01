import { useEffect, useState } from 'react';
import { DEFAULT_COLUMNS } from '../constants';
import { supabase } from '../lib/supabaseClient';
import type { BoardColumn, ColumnId } from '../types';

export function useColumns(userId: string, onError: (message: string) => void) {
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from('columns')
        .select('id, title')
        .order('position', { ascending: true });
      if (cancelled) return;
      if (error) {
        onError('Could not load your columns. Please refresh.');
        setLoading(false);
        return;
      }

      if (data.length > 0) {
        setColumns(data);
        setLoading(false);
        return;
      }

      // First visit: seed the default columns. Their ids match the slugs
      // existing cards already use. Duplicate inserts (e.g. StrictMode) are ignored.
      setColumns(DEFAULT_COLUMNS);
      const { error: seedError } = await supabase.from('columns').upsert(
        DEFAULT_COLUMNS.map((column, position) => ({ ...column, user_id: userId, position })),
        { onConflict: 'user_id,id', ignoreDuplicates: true },
      );
      if (seedError && !cancelled) onError('Could not save the default columns.');
      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function persistOrder(next: BoardColumn[], previous: BoardColumn[]) {
    setColumns(next);
    const { error } = await supabase.from('columns').upsert(
      next.map((column, position) => ({ ...column, user_id: userId, position })),
      { onConflict: 'user_id,id' },
    );
    if (error) {
      setColumns(previous);
      onError('Could not save the column order.');
    }
  }

  async function addColumn(title: string) {
    const column: BoardColumn = { id: crypto.randomUUID(), title: title.trim() };
    const previous = columns;
    setColumns([...previous, column]);
    const { error } = await supabase
      .from('columns')
      .insert({ ...column, user_id: userId, position: previous.length });
    if (error) {
      setColumns(previous);
      onError('Could not add the column.');
    }
  }

  async function renameColumn(id: ColumnId, title: string) {
    const trimmed = title.trim();
    const previous = columns;
    if (!trimmed) return;
    setColumns(previous.map((column) => (column.id === id ? { ...column, title: trimmed } : column)));
    const { error } = await supabase.from('columns').update({ title: trimmed }).eq('id', id);
    if (error) {
      setColumns(previous);
      onError('Could not rename the column.');
    }
  }

  /** Moves a column to `toIndex`; the other columns shift to make room. */
  function reorderColumn(id: ColumnId, toIndex: number) {
    const fromIndex = columns.findIndex((column) => column.id === id);
    if (fromIndex === -1 || toIndex < 0 || toIndex >= columns.length || toIndex === fromIndex) return;
    const next = [...columns];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    persistOrder(next, columns);
  }

  async function deleteColumn(id: ColumnId): Promise<number | undefined> {
    const index = columns.findIndex((column) => column.id === id);
    if (index === -1) return undefined;
    const previous = columns;
    setColumns(previous.filter((column) => column.id !== id));
    const { error } = await supabase.from('columns').delete().eq('id', id);
    if (error) {
      setColumns(previous);
      onError('Could not delete the column.');
      return undefined;
    }
    return index;
  }

  async function restoreColumn(column: BoardColumn, index: number) {
    const next = [...columns];
    next.splice(Math.min(index, next.length), 0, column);
    setColumns(next);
    const { error } = await supabase
      .from('columns')
      .upsert(next.map((c, position) => ({ ...c, user_id: userId, position })), {
        onConflict: 'user_id,id',
      });
    if (error) {
      setColumns(columns);
      onError('Could not restore the column.');
    }
  }

  return { columns, loading, addColumn, renameColumn, reorderColumn, deleteColumn, restoreColumn };
}

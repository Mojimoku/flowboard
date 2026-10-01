import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Card, CardInput, ColumnId } from '../types';

interface CardRow {
  id: string;
  title: string;
  assignee: string;
  priority: Card['priority'];
  due_date: string;
  column_id: ColumnId;
  created_at: string;
}

const CARD_COLUMNS = 'id, title, assignee, priority, due_date, column_id, created_at';

function fromRow(row: CardRow): Card {
  return {
    id: row.id,
    title: row.title,
    assignee: row.assignee,
    priority: row.priority,
    dueDate: row.due_date,
    columnId: row.column_id,
  };
}

export function useCards(userId: string, onError: (message: string) => void) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  // Remembered so an undone delete returns the card to its original position.
  const createdAt = useRef(new Map<string, string>());

  useEffect(() => {
    let cancelled = false;

    supabase
      .from('cards')
      .select(CARD_COLUMNS)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) onError('Could not load your cards. Please refresh.');
        else if (data) {
          data.forEach((row) => createdAt.current.set(row.id, row.created_at));
          setCards(data.map(fromRow));
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function addCard(columnId: ColumnId, input: CardInput) {
    const { data, error } = await supabase
      .from('cards')
      .insert({
        user_id: userId,
        title: input.title,
        assignee: input.assignee,
        priority: input.priority,
        due_date: input.dueDate,
        column_id: columnId,
      })
      .select(CARD_COLUMNS)
      .single();

    if (error || !data) {
      onError('Could not add the card.');
      return;
    }
    createdAt.current.set(data.id, data.created_at);
    setCards((prev) => [...prev, fromRow(data)]);
  }

  async function updateCard(id: string, input: CardInput) {
    const snapshot = cards;
    setCards((prev) =>
      prev.map((card) => (card.id === id ? { ...card, ...input } : card)),
    );

    const { error } = await supabase
      .from('cards')
      .update({
        title: input.title,
        assignee: input.assignee,
        priority: input.priority,
        due_date: input.dueDate,
      })
      .eq('id', id);
    if (error) {
      setCards(snapshot);
      onError('Could not save your changes.');
    }
  }

  async function deleteCard(id: string): Promise<Card | undefined> {
    const removed = cards.find((card) => card.id === id);
    setCards((prev) => prev.filter((card) => card.id !== id));
    const { error } = await supabase.from('cards').delete().eq('id', id);
    if (error) {
      if (removed) setCards((prev) => sortByCreated([...prev, removed]));
      onError('Could not delete the card.');
      return undefined;
    }
    return removed;
  }

  async function restoreCards(toRestore: Card[]) {
    setCards((prev) => sortByCreated([...prev, ...toRestore]));
    const { error } = await supabase.from('cards').insert(
      toRestore.map((card) => ({
        id: card.id,
        user_id: userId,
        title: card.title,
        assignee: card.assignee,
        priority: card.priority,
        due_date: card.dueDate,
        column_id: card.columnId,
        created_at: createdAt.current.get(card.id),
      })),
    );
    if (error) {
      const ids = new Set(toRestore.map((card) => card.id));
      setCards((prev) => prev.filter((card) => !ids.has(card.id)));
      onError('Could not undo the delete.');
    }
  }

  /** Moves every card in `ids` to a column (used when a column is deleted or its deletion undone). */
  async function moveCards(ids: string[], targetColumnId: ColumnId) {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const previous = cards;
    setCards((prev) => prev.map((card) => (idSet.has(card.id) ? { ...card, columnId: targetColumnId } : card)));
    const { error } = await supabase.from('cards').update({ column_id: targetColumnId }).in('id', ids);
    if (error) {
      setCards(previous);
      onError('Could not move the cards.');
    }
  }

  function sortByCreated(list: Card[]) {
    return [...list].sort((a, b) =>
      (createdAt.current.get(a.id) ?? '').localeCompare(createdAt.current.get(b.id) ?? ''),
    );
  }

  async function moveCard(id: string, targetColumnId: ColumnId) {
    const snapshot = cards;
    setCards((prev) =>
      prev.map((card) =>
        card.id === id ? { ...card, columnId: targetColumnId } : card,
      ),
    );

    const { error } = await supabase.from('cards').update({ column_id: targetColumnId }).eq('id', id);
    if (error) {
      setCards(snapshot);
      onError('Could not move the card.');
    }
  }

  return { cards, loading, addCard, updateCard, deleteCard, restoreCards, moveCard, moveCards };
}

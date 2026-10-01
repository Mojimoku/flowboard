import { useEffect, useRef, useState } from 'react';
import { PRIORITIES } from '../constants';
import { useAuth } from '../hooks/useAuth';
import { useCardDrag } from '../hooks/useCardDrag';
import { useCards } from '../hooks/useCards';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { useColumns } from '../hooks/useColumns';
import { burstConfetti } from '../lib/confetti';
import { UNCATEGORIZED, type BoardColumn, type Card, type ColumnId, type Priority } from '../types';
import { CardModal, type CardModalState } from './CardModal';
import { AddColumn } from './AddColumn';
import { Column } from './Column';
import { LandmarksMenu } from './LandmarksMenu';
import { OptionsMenu } from './OptionsMenu';
import { ShortcutsDialog } from './ShortcutsDialog';
import { CardFace } from './TaskCard';
import { UncategorizedSection } from './UncategorizedSection';

interface BoardProps {
  userId: string;
  userEmail: string | undefined;
}

export function Board({ userId, userEmail }: BoardProps) {
  const { signOut } = useAuth();
  const [reduceMotion, setReduceMotion] = useReduceMotion();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('');
  const [sortByDue, setSortByDue] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const pendingFocusId = useRef<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const showError = (message: string) => setToast({ message });
  const {
    columns,
    loading: columnsLoading,
    addColumn,
    renameColumn,
    reorderColumn,
    deleteColumn,
    restoreColumn,
  } = useColumns(userId, showError);
  const { cards, loading: cardsLoading, addCard, updateCard, deleteCard, restoreCards, moveCard, moveCards } =
    useCards(userId, showError);
  const loading = columnsLoading || cardsLoading;
  const [draggingColumnId, setDraggingColumnId] = useState<ColumnId | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<ColumnId | null>(null);
  const [modalState, setModalState] = useState<CardModalState | null>(null);
  const { floating, draggingCardId, overColumnId, handleDragStart, handleDragMove, handleDragEnd } =
    useCardDrag({ onDrop: handleDropCard, reduceMotion });

  const isFiltering = query.trim() !== '' || assigneeFilter !== '' || priorityFilter !== '';
  const assignees = [...new Set(cards.map((card) => card.assignee))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );

  // A card whose column no longer exists (e.g. a failed cleanup) is shown as uncategorized.
  function columnOf(card: Card): ColumnId {
    return columns.some((column) => column.id === card.columnId) ? card.columnId : UNCATEGORIZED;
  }

  function visibleCards(columnId: ColumnId) {
    const needle = query.trim().toLowerCase();
    const list = cards.filter(
      (card) =>
        columnOf(card) === columnId &&
        (!needle ||
          card.title.toLowerCase().includes(needle) ||
          card.assignee.toLowerCase().includes(needle)) &&
        (!assigneeFilter || card.assignee === assigneeFilter) &&
        (!priorityFilter || card.priority === priorityFilter),
    );
    return sortByDue ? [...list].sort((a, b) => a.dueDate.localeCompare(b.dueDate)) : list;
  }

  function clearFilters() {
    setQuery('');
    setAssigneeFilter('');
    setPriorityFilter('');
  }

  // Ctrl/Cmd+K jumps to search. Uses a modifier so it can't fire by accident (WCAG 2.1.4).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || modalState || shortcutsOpen) return;
      if (event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === '/') {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [modalState, shortcutsOpen]);

  // Cards remount when they change column, so focus is restored after the move renders.
  useEffect(() => {
    const id = pendingFocusId.current;
    if (!id) return;
    pendingFocusId.current = null;
    document.querySelector<HTMLElement>(`[data-card-id="${id}"]`)?.focus();
  }, [cards]);

  function handleSave(input: Parameters<typeof addCard>[1], columnId: ColumnId) {
    if (!modalState) return;
    if (modalState.mode === 'add') {
      addCard(columnId, input);
    } else {
      updateCard(modalState.card.id, input);
      // Keyboard/screen-reader alternative to dragging a card between columns.
      if (columnId !== columnOf(modalState.card)) {
        handleDropCard(modalState.card.id, columnId, {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });
        setAnnouncement(`Moved ${input.title} to ${columnId === UNCATEGORIZED ? 'Uncategorized' : (columns.find((c) => c.id === columnId)?.title ?? 'column')}`);
      }
    }
    setModalState(null);
  }

  async function handleDelete(id: string) {
    setModalState(null);
    const removed = await deleteCard(id);
    if (removed) showUndo('Card deleted', [removed]);
  }

  function showUndo(message: string, removed: Card[]) {
    setToast({
      message,
      undo: () => {
        restoreCards(removed);
        setToast(null);
      },
    });
  }

  function handleCardKeyDown(card: Card, event: React.KeyboardEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const container = element.closest<HTMLElement>('[data-column-id]');
    const siblings = Array.from(container?.querySelectorAll<HTMLElement>('[data-card-id]') ?? []);
    const index = siblings.indexOf(element);
    const isUncategorized = columnOf(card) === UNCATEGORIZED;
    const columnIds = columns.map((column) => column.id);
    const columnIndex = columnIds.indexOf(columnOf(card));

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      pendingFocusId.current = (siblings[index + 1] ?? siblings[index - 1])?.dataset.cardId ?? null;
      handleDelete(card.id);
      return;
    }

    if (event.shiftKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      const targetIndex = event.key === 'ArrowRight' ? columnIndex + 1 : columnIndex - 1;
      const target = columns[targetIndex];
      if (!target || (isUncategorized && event.key === 'ArrowLeft')) return;
      const rect = element.getBoundingClientRect();
      pendingFocusId.current = card.id;
      handleDropCard(card.id, target.id, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      setAnnouncement(`Moved ${card.title} to ${target.title}`);
      return;
    }

    const vertical = isUncategorized ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
    if (event.key === vertical[0] || event.key === vertical[1]) {
      event.preventDefault();
      siblings[event.key === vertical[1] ? index + 1 : index - 1]?.focus();
      return;
    }

    if (!isUncategorized && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      const neighbour = columnIds[columnIndex + (event.key === 'ArrowRight' ? 1 : -1)];
      if (!neighbour) return;
      const cardsThere = document.querySelectorAll<HTMLElement>(`[data-column-id="${neighbour}"] [data-card-id]`);
      cardsThere[Math.min(index, cardsThere.length - 1)]?.focus();
    }
  }

  function handleDeleteColumn(column: BoardColumn) {
    const movedIds = cards.filter((card) => card.columnId === column.id).map((card) => card.id);
    deleteColumn(column.id).then(async (index) => {
      if (index === undefined) return;
      await moveCards(movedIds, UNCATEGORIZED);
      const detail =
        movedIds.length > 0
          ? ` · ${movedIds.length} ${movedIds.length === 1 ? 'card' : 'cards'} moved to Uncategorized`
          : '';
      setToast({
        message: `Deleted "${column.title}"${detail}`,
        undo: async () => {
          setToast(null);
          await restoreColumn(column, index);
          await moveCards(movedIds, column.id);
        },
      });
    });
  }

  function handleColumnDrop(targetId: ColumnId) {
    const toIndex = columns.findIndex((column) => column.id === targetId);
    if (draggingColumnId && toIndex !== -1) reorderColumn(draggingColumnId, toIndex);
    setDraggingColumnId(null);
    setDragOverColumnId(null);
  }

  function handleDropCard(
    cardId: string,
    columnId: ColumnId,
    position: { x: number; y: number },
  ) {
    const card = cards.find((existing) => existing.id === cardId);
    if (card && card.columnId !== 'done' && columnId === 'done') {
      burstConfetti(position.x, position.y, card.title, reduceMotion);
    }
    moveCard(cardId, columnId);
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <LandmarksMenu columns={columns} />
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 px-4 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-medium text-[#0a0a0a]">Flowboard</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-[#585868]">
          <OptionsMenu
            reduceMotion={reduceMotion}
            onToggleReduceMotion={() => setReduceMotion(!reduceMotion)}
            onOpenShortcuts={() => setShortcutsOpen(true)}
          />
          <span>{userEmail}</span>
          <button
            type="button"
            onClick={signOut}
            className="rounded-[10px] px-3 py-1.5 font-medium text-[#0a0a0a] hover:bg-black/5"
          >
            Sign out
          </button>
        </div>
      </header>

      <div id="filters" tabIndex={-1} role="search" className="flex flex-wrap items-center gap-3 border-b border-black/10 px-4 py-3 sm:px-8">
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setQuery('');
              event.currentTarget.blur();
            }
          }}
          placeholder="Search cards…  (Ctrl+K)"
          aria-label="Search cards by title or assignee"
          className="w-64 rounded-[10px] border border-[#767676] px-3 py-1.5 text-sm focus:border-[#0369a1] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0369a1]"
        />
        <select
          value={assigneeFilter}
          onChange={(event) => setAssigneeFilter(event.target.value)}
          aria-label="Filter by assignee"
          className="rounded-[10px] border border-[#767676] px-3 py-1.5 text-sm focus:border-[#0369a1] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0369a1]"
        >
          <option value="">All assignees</option>
          {assignees.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value as Priority | '')}
          aria-label="Filter by priority"
          className="rounded-[10px] border border-[#767676] px-3 py-1.5 text-sm focus:border-[#0369a1] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0369a1]"
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {priority}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={sortByDue}
          onClick={() => setSortByDue((value) => !value)}
          className={`rounded-[10px] border px-3 py-1.5 text-sm ${
            sortByDue
              ? 'border-[#0369a1] bg-[#0369a1]/10 text-[#0369a1]'
              : 'border-black/10 text-[#0a0a0a] hover:bg-black/5'
          }`}
        >
          Sort by due date
        </button>
        {isFiltering && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-medium text-[#0369a1] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      <main
        id="board"
        tabIndex={-1}
        aria-busy={loading}
        className="flex flex-1 flex-col overflow-hidden outline-none"
      >
        <div className="flex min-h-0 flex-1 gap-4 overflow-x-auto overflow-y-hidden p-4 sm:p-8">
          {columns.map((column, index) => (
            <Column
              key={column.id}
              id={column.id}
              title={column.title}
              cards={visibleCards(column.id)}
              isFiltering={isFiltering}
              index={index}
              columnCount={columns.length}
              isColumnDragOver={dragOverColumnId === column.id && draggingColumnId !== column.id}
              onRename={(title) => renameColumn(column.id, title)}
              onDelete={() => handleDeleteColumn(column)}
              onMove={(toIndex) => reorderColumn(column.id, toIndex)}
              onColumnDragStart={setDraggingColumnId}
              onColumnDragOver={setDragOverColumnId}
              onColumnDrop={handleColumnDrop}
              onColumnDragEnd={() => {
                setDraggingColumnId(null);
                setDragOverColumnId(null);
              }}
              loading={loading}
              isDropTarget={overColumnId === column.id}
              draggingCardId={draggingCardId}
              onAddCard={() => setModalState({ mode: 'add', columnId: column.id })}
              onEditCard={(card: Card) => setModalState({ mode: 'edit', card })}
              onCardKeyDown={handleCardKeyDown}
              onCardDragStart={handleDragStart}
              onCardDragMove={handleDragMove}
              onCardDragEnd={handleDragEnd}
            />
          ))}
          {!loading && <AddColumn onAdd={addColumn} />}
        </div>

        <UncategorizedSection
          cards={visibleCards(UNCATEGORIZED)}
          allCards={cards.filter((card) => columnOf(card) === UNCATEGORIZED)}
          isFiltering={isFiltering}
          draggingCardId={draggingCardId}
          onEditCard={(card: Card) => setModalState({ mode: 'edit', card })}
          onCardKeyDown={handleCardKeyDown}
          onDeleteCard={deleteCard}
          onIncinerated={(burned) =>
            showUndo(`Incinerated ${burned.length} ${burned.length === 1 ? 'card' : 'cards'}`, burned)
          }
          onCardDragStart={handleDragStart}
          onCardDragMove={handleDragMove}
          onCardDragEnd={handleDragEnd}
        />
      </main>

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <div role="status" className="sr-only">
        {loading
          ? 'Loading board'
          : isFiltering
            ? `${columns.reduce((n, c) => n + visibleCards(c.id).length, 0) + visibleCards(UNCATEGORIZED).length} cards match`
            : ''}
      </div>

      {toast && (
        <div
          role={toast.undo ? 'status' : 'alert'}
          className="fixed bottom-6 left-1/2 z-[10001] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-4 rounded-[10px] bg-[#0a0a0a] px-4 py-2.5 text-sm text-white shadow-xl"
        >
          <span>{toast.message}</span>
          {toast.undo && (
            <button type="button" onClick={toast.undo} className="font-medium underline">
              Undo
            </button>
          )}
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss notification"
            className="-mr-1 flex h-7 w-7 items-center justify-center rounded-md text-lg hover:bg-white/15"
          >
            <span aria-hidden>&times;</span>
          </button>
        </div>
      )}

      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}

      {modalState && (
        <CardModal
          state={modalState}
          columns={columns}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setModalState(null)}
        />
      )}

      {floating && (
        <div
          aria-hidden
          className="fixed z-[10000] rounded-[10px] border border-black/10 bg-white p-3 text-left shadow-xl"
          style={{
            left: floating.left,
            top: floating.top,
            width: floating.width,
            height: floating.height,
            transform: floating.transform,
            transformOrigin: floating.transformOrigin,
            pointerEvents: 'none',
            willChange: 'transform',
          }}
        >
          <CardFace card={floating.card} />
        </div>
      )}
    </div>
  );
}

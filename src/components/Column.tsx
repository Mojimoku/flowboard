import { useState } from 'react';
import { useMenu } from '../hooks/useMenu';
import type { Card, ColumnId } from '../types';
import { TaskCard } from './TaskCard';

interface ColumnProps {
  id: ColumnId;
  title: string;
  cards: Card[];
  loading: boolean;
  isFiltering: boolean;
  isDropTarget: boolean;
  draggingCardId: string | null;
  index: number;
  columnCount: number;
  /** True while another column is being dragged over this one. */
  isColumnDragOver: boolean;
  onRename: (title: string) => void;
  onDelete: () => void;
  onMove: (toIndex: number) => void;
  onColumnDragStart: (id: ColumnId) => void;
  onColumnDragOver: (id: ColumnId) => void;
  onColumnDrop: (id: ColumnId) => void;
  onColumnDragEnd: () => void;
  onAddCard: () => void;
  onEditCard: (card: Card) => void;
  onCardKeyDown: (card: Card, event: React.KeyboardEvent<HTMLDivElement>) => void;
  onCardDragStart: (card: Card, cardElement: HTMLElement, clientX: number, clientY: number) => void;
  onCardDragMove: (clientX: number, clientY: number) => void;
  onCardDragEnd: (clientX: number, clientY: number) => void;
}

export function Column({
  id,
  title,
  cards,
  loading,
  isFiltering,
  isDropTarget,
  draggingCardId,
  index,
  columnCount,
  isColumnDragOver,
  onRename,
  onDelete,
  onMove,
  onColumnDragStart,
  onColumnDragOver,
  onColumnDrop,
  onColumnDragEnd,
  onAddCard,
  onEditCard,
  onCardKeyDown,
  onCardDragStart,
  onCardDragMove,
  onCardDragEnd,
}: ColumnProps) {
  const { open: menuOpen, rootRef: menuRef, triggerProps, listProps, closeMenu } = useMenu();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title);

  function commitRename() {
    setRenaming(false);
    if (draft.trim() && draft.trim() !== title) onRename(draft);
  }

  function menuItem(label: string, action: () => void, disabled = false, danger = false) {
    return (
      <li role="none">
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => {
            closeMenu(true);
            action();
          }}
          className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-black/5 focus:bg-black/10 disabled:cursor-not-allowed disabled:opacity-40 ${
            danger ? 'text-[#b3122f]' : 'text-[#0a0a0a]'
          }`}
        >
          {label}
        </button>
      </li>
    );
  }

  return (
    <div
      data-column-id={id}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('application/x-flowboard-column')) return;
        event.preventDefault();
        onColumnDragOver(id);
      }}
      onDrop={(event) => {
        if (!event.dataTransfer.types.includes('application/x-flowboard-column')) return;
        event.preventDefault();
        onColumnDrop(id);
      }}
      className={`flex min-h-0 w-[280px] shrink-0 flex-col gap-4 rounded-[10px] bg-[#f3f4f6] p-4 transition ${
        isDropTarget || isColumnDragOver ? 'ring-2 ring-[#0369a1]' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          draggable
          aria-hidden
          title="Drag to reorder"
          onDragStart={(event) => {
            event.dataTransfer.setData('application/x-flowboard-column', id);
            event.dataTransfer.effectAllowed = 'move';
            const columnEl = event.currentTarget.closest<HTMLElement>('[data-column-id]');
            if (columnEl) event.dataTransfer.setDragImage(columnEl, 20, 20);
            onColumnDragStart(id);
          }}
          onDragEnd={onColumnDragEnd}
          className="cursor-grab select-none text-[#585868] hover:text-[#0a0a0a] active:cursor-grabbing"
        >
          ⠿
        </span>

        {renaming ? (
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitRename();
              if (event.key === 'Escape') setRenaming(false);
            }}
            aria-label="Column name"
            className="min-w-0 flex-1 rounded-md border border-[#0369a1] px-1.5 py-0.5 text-sm font-medium outline-none"
          />
        ) : (
          <h2 tabIndex={-1} className="min-w-0 flex-1 break-words text-sm font-medium text-[#0a0a0a]">{title}</h2>
        )}

        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-[#585868]">
          {cards.length}
        </span>

        <div ref={menuRef} className="relative">
          <button
            {...triggerProps}
            type="button"
            aria-label={`${title} column options`}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#585868] hover:bg-black/5 hover:text-[#0a0a0a]"
          >
            <span aria-hidden>⋯</span>
          </button>
          {menuOpen && (
            <ul
              {...listProps}
              aria-label={`${title} column options`}
              className="absolute right-0 top-8 z-20 w-40 list-none overflow-hidden rounded-[10px] border border-black/10 bg-white py-1 shadow-lg"
            >
              {menuItem('Rename', () => {
                setDraft(title);
                setRenaming(true);
              })}
              {menuItem('Move left', () => onMove(index - 1), index === 0)}
              {menuItem('Move right', () => onMove(index + 1), index === columnCount - 1)}
              {menuItem('Delete column', onDelete, false, true)}
            </ul>
          )}
        </div>
      </div>

      <div className="-m-1 flex min-h-[80px] flex-1 flex-col gap-2 overflow-y-auto p-1">
        {loading ? (
          [0, 1, 2].map((i) => (
            <div key={i} aria-hidden className="h-[88px] animate-pulse rounded-[10px] bg-white" />
          ))
        ) : cards.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-[10px] border-2 border-dashed border-black/10 bg-white p-6 text-center">
            <p className="text-sm text-[#585868]">
              {isFiltering ? 'No matching cards' : 'Drop a card here or add one below'}
            </p>
          </div>
        ) : (
          cards.map((card) => (
            <TaskCard
              key={card.id}
              card={card}
              isDragging={card.id === draggingCardId}
              onEdit={() => onEditCard(card)}
              onKeyDown={(event) => onCardKeyDown(card, event)}
              onDragStart={onCardDragStart}
              onDragMove={onCardDragMove}
              onDragEnd={onCardDragEnd}
            />
          ))
        )}
      </div>

      <button
        type="button"
        onClick={onAddCard}
        className="flex items-center gap-2 text-sm font-medium text-[#585868] hover:text-[#0a0a0a]"
      >
        <span aria-hidden>+</span>
        Add card
      </button>
    </div>
  );
}

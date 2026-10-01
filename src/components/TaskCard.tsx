import { useRef } from 'react';
import { PRIORITY_STYLES } from '../constants';
import type { Card } from '../types';

interface TaskCardProps {
  card: Card;
  isDragging: boolean;
  onEdit: () => void;
  onDragStart: (card: Card, cardElement: HTMLElement, clientX: number, clientY: number) => void;
  onDragMove: (clientX: number, clientY: number) => void;
  onDragEnd: (clientX: number, clientY: number) => void;
  /** Extra keyboard shortcuts (arrows, delete); Enter/Space always open the editor. */
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  /** Static resting transform (tilt + drop), used for the Uncategorized pile. */
  restingTransform?: string;
  /** Plays the incinerate animation: blackens the card as fire emoji rise from it. */
  isBurning?: boolean;
}

const FIRE_EMOJI_OFFSETS = ['18%', '45%', '72%'];

const DRAG_THRESHOLD_PX = 4;

function formatDueDate(dueDate: string): string {
  const parsed = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dueDate;
  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

type DueUrgency = 'overdue' | 'soon' | 'normal';

function dueUrgency(card: Card): { urgency: DueUrgency; label: string } {
  const formatted = formatDueDate(card.dueDate);
  if (card.columnId === 'done') return { urgency: 'normal', label: `Due ${formatted}` };

  const due = new Date(`${card.dueDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return { urgency: 'normal', label: `Due ${formatted}` };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (days < 0) return { urgency: 'overdue', label: `Overdue · ${formatted}` };
  if (days === 0) return { urgency: 'soon', label: 'Due today' };
  if (days === 1) return { urgency: 'soon', label: 'Due tomorrow' };
  return { urgency: 'normal', label: `Due ${formatted}` };
}

const DUE_STYLES: Record<DueUrgency, string> = {
  overdue: 'font-medium text-red-700',
  soon: 'font-medium text-amber-700',
  normal: 'text-[#585868]',
};

export function CardFace({ card }: { card: Card }) {
  const due = dueUrgency(card);
  return (
    <>
      <p className="break-words text-sm font-normal text-[#0a0a0a]">
        {card.title}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="min-w-0 break-words text-xs text-[#585868]">
          {card.assignee}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${PRIORITY_STYLES[card.priority]}`}
        >
          {card.priority}
        </span>
      </div>
      <p className={`mt-1.5 text-xs ${DUE_STYLES[due.urgency]}`}>{due.label}</p>
    </>
  );
}

export function TaskCard({
  card,
  isDragging,
  onEdit,
  onDragStart,
  onDragMove,
  onDragEnd,
  onKeyDown,
  restingTransform,
  isBurning = false,
}: TaskCardProps) {
  const pointerState = useRef<{ startX: number; startY: number; dragging: boolean } | null>(null);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || isBurning) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerState.current = { startX: event.clientX, startY: event.clientY, dragging: false };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const state = pointerState.current;
    if (!state) return;

    if (!state.dragging) {
      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      state.dragging = true;
      onDragStart(card, event.currentTarget, state.startX, state.startY);
    }
    onDragMove(event.clientX, event.clientY);
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const state = pointerState.current;
    pointerState.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (state?.dragging) {
      onDragEnd(event.clientX, event.clientY);
    } else if (state) {
      onEdit();
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || isBurning) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onEdit();
      return;
    }
    onKeyDown?.(event);
  }

  return (
    <div
      role="button"
      tabIndex={isBurning ? -1 : 0}
      data-card-id={card.id}
      aria-label={`${card.title}, ${card.assignee}, ${card.priority} priority, ${dueUrgency(card).label.toLowerCase()}`}
      aria-keyshortcuts="Enter Shift+ArrowLeft Shift+ArrowRight Delete"
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ touchAction: 'none', transform: restingTransform }}
      className={`relative w-full select-none rounded-[10px] border border-black/10 bg-white p-3 text-left shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0369a1] ${
        isDragging
          ? 'opacity-30'
          : isBurning
            ? 'cursor-default'
            : 'cursor-grab hover:border-black/20 active:cursor-grabbing'
      }`}
    >
      <CardFace card={card} />
      {isBurning && (
        <>
          <div className="absolute inset-0 animate-[burn-blacken_500ms_ease-in_forwards] rounded-[10px] bg-black" />
          {FIRE_EMOJI_OFFSETS.map((left, index) => (
            <span
              key={left}
              aria-hidden
              className="absolute bottom-1 animate-[burn-rise_900ms_ease-out_forwards] text-base"
              style={{ left, animationDelay: `${index * 120}ms` }}
            >
              🔥
            </span>
          ))}
        </>
      )}
    </div>
  );
}

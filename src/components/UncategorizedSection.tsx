import { useState } from 'react';
import { restingDropForCard, tiltAngleForCard } from '../lib/cardTilt';
import type { Card } from '../types';
import { IncinerateDialog } from './IncinerateDialog';
import { TaskCard } from './TaskCard';

interface UncategorizedSectionProps {
  cards: Card[];
  /** Every uncategorized card, ignoring filters; incinerate always targets all of them. */
  allCards: Card[];
  isFiltering: boolean;
  draggingCardId: string | null;
  onEditCard: (card: Card) => void;
  onCardKeyDown: (card: Card, event: React.KeyboardEvent<HTMLDivElement>) => void;
  onDeleteCard: (id: string) => Promise<Card | undefined>;
  onIncinerated: (cards: Card[]) => void;
  onCardDragStart: (card: Card, cardElement: HTMLElement, clientX: number, clientY: number) => void;
  onCardDragMove: (clientX: number, clientY: number) => void;
  onCardDragEnd: (clientX: number, clientY: number) => void;
}

const BURN_VISUAL_MS = 900;
const BURN_CADENCE_MS = 1250;

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function UncategorizedSection({
  cards,
  allCards,
  isFiltering,
  draggingCardId,
  onEditCard,
  onCardKeyDown,
  onDeleteCard,
  onIncinerated,
  onCardDragStart,
  onCardDragMove,
  onCardDragEnd,
}: UncategorizedSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [burningCardId, setBurningCardId] = useState<string | null>(null);
  const [isIncinerating, setIsIncinerating] = useState(false);

  async function handleConfirmIncinerate() {
    setDialogOpen(false);
    setIsIncinerating(true);

    const burned: Card[] = [];
    for (const card of allCards) {
      setBurningCardId(card.id);
      await delay(BURN_VISUAL_MS);
      if (await onDeleteCard(card.id)) burned.push(card);
      setBurningCardId(null);
      const remaining = BURN_CADENCE_MS - BURN_VISUAL_MS;
      if (remaining > 0) await delay(remaining);
    }

    setIsIncinerating(false);
    if (burned.length > 0) onIncinerated(burned);
  }

  return (
    <section
      aria-labelledby="uncategorized-heading"
      data-column-id="uncategorized"
      className="mt-auto flex w-full shrink-0 flex-col gap-4 p-4"
    >
      <div className="flex items-center gap-4">
        <h2 id="uncategorized-heading" tabIndex={-1} className="text-sm font-medium text-[#0a0a0a]">Uncategorized</h2>
        <span className="rounded-full bg-[#ebebeb] px-2 py-0.5 text-xs text-[#585868]">
          {isFiltering ? `${cards.length} of ${allCards.length}` : cards.length}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          disabled={allCards.length === 0 || isIncinerating}
          onClick={() => setDialogOpen(true)}
          className="rounded-[10px] bg-[#b62400] px-2 py-1 text-sm font-medium text-white transition hover:bg-[#9c1f00] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span aria-hidden>🔥</span> Incinerate
        </button>
      </div>

      <div className="border-t border-black/10" />

      <div className="flex min-h-[100px] items-start gap-4 overflow-visible">
        {cards.map((card) => (
          <div key={card.id} className="w-[240px] shrink-0">
            <TaskCard
              card={card}
              isDragging={card.id === draggingCardId}
              isBurning={card.id === burningCardId}
              restingTransform={`translateY(${restingDropForCard(card.id)}px) rotate(${tiltAngleForCard(card.id)}deg)`}
              onEdit={() => onEditCard(card)}
              onKeyDown={(event) => onCardKeyDown(card, event)}
              onDragStart={onCardDragStart}
              onDragMove={onCardDragMove}
              onDragEnd={onCardDragEnd}
            />
          </div>
        ))}
      </div>

      {dialogOpen && (
        <IncinerateDialog
          count={allCards.length}
          onCancel={() => setDialogOpen(false)}
          onConfirm={handleConfirmIncinerate}
        />
      )}
    </section>
  );
}

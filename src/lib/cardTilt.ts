/**
 * Deterministic per-card resting tilt, in degrees, for the Uncategorized
 * pile: always in [-5,-1] or [1,5], never 0. Derived from the card's id
 * (not Math.random()) so a given card keeps the same tilt across re-renders
 * and reloads instead of jittering every time the list re-renders.
 */
export function tiltAngleForCard(cardId: string): number {
  let hash = 0;
  for (let i = 0; i < cardId.length; i++) {
    hash = (hash * 31 + cardId.charCodeAt(i)) | 0;
  }
  const unsigned = Math.abs(hash);
  const magnitude = 1 + (unsigned % 5); // 1..5
  const sign = unsigned & 1 ? 1 : -1;
  return sign * magnitude;
}

/**
 * Deterministic small downward nudge (px) so each card in the pile rests at
 * a slightly different depth below the viewport edge, rather than a single
 * flat line of cards.
 */
export function restingDropForCard(cardId: string): number {
  let hash = 0;
  for (let i = 0; i < cardId.length; i++) {
    hash = (hash * 17 + cardId.charCodeAt(i)) | 0;
  }
  return 10 + (Math.abs(hash) % 12); // 10..21px
}

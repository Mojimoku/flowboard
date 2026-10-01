import { useId } from 'react';
import { useDialog } from '../hooks/useDialog';

interface ShortcutsDialogProps {
  onClose: () => void;
}

interface Row {
  keys: string[][];
  description: string;
}

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: 'Getting around',
    rows: [
      { keys: [['Tab'], ['Shift', 'Tab']], description: 'Move to the next or previous control or card. The very first Tab stop is the hidden "Jump to…" menu, which appears when focused.' },
      { keys: [['↑'], ['↓']], description: 'With a card focused: previous or next card in the same column.' },
      { keys: [['←'], ['→']], description: 'With a card focused: the card at the same position in the neighbouring column (in Uncategorized: previous or next card).' },
      { keys: [['↑'], ['↓']], description: 'In any menu (Jump to…, Options, column options): move between items. Going past the last item wraps to the first, and vice versa. Home and End jump to the ends; Esc closes the menu.' },
      { keys: [[MOD, 'K']], description: 'Jump to search. Esc clears the search.' },
      { keys: [[MOD, '/']], description: 'Open this dialog.' },
    ],
  },
  {
    title: 'Working with cards',
    rows: [
      { keys: [['Enter'], ['Space']], description: 'Open the focused card to edit it. Use its Column menu to move it to any column, including Uncategorized.' },
      { keys: [['Shift', '←'], ['Shift', '→']], description: 'Move the focused card to the previous or next column. Shift + → on an Uncategorized card sends it to the first column.' },
      { keys: [['Delete'], ['Backspace']], description: 'Delete the focused card. An Undo button appears in the notification.' },
      { keys: [['Esc']], description: 'Close any dialog or menu and return to where you were.' },
    ],
  },
  {
    title: 'Columns',
    rows: [
      { keys: [['Tab'], ['Enter']], description: 'Each column header has a "column options" button (⋯) with Rename, Move left, Move right and Delete column. Dragging the ⠿ grip is optional.' },
      { keys: [['Tab'], ['Enter']], description: 'The "Add column" button after the last column creates a new one.' },
    ],
  },
];

export function ShortcutsDialog({ onClose }: ShortcutsDialogProps) {
  const dialogRef = useDialog<HTMLDivElement>(onClose);
  const titleId = useId();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90vh] w-full max-w-[640px] flex-col gap-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-medium text-[#0a0a0a]">
            Keyboard shortcuts and accessibility
          </h2>
          <button
            type="button"
            onClick={onClose}
            data-autofocus
            aria-label="Close"
            className="-m-1.5 flex h-9 w-9 items-center justify-center rounded-[10px] text-xl text-[#585868] hover:bg-black/5 hover:text-[#0a0a0a]"
          >
            <span aria-hidden>&times;</span>
          </button>
        </div>

        {SECTIONS.map((section) => (
          <section key={section.title} className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-[#0a0a0a]">{section.title}</h3>
            <dl className="flex flex-col divide-y divide-black/10 rounded-[10px] border border-black/10">
              {section.rows.map((row) => (
                <div key={row.description} className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:gap-4">
                  <dt className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 sm:w-44">
                    {row.keys.map((combo, index) => (
                      <span key={combo.join('+')} className="flex items-center gap-1">
                        {index > 0 && <span className="text-xs text-[#585868]">or</span>}
                        {combo.map((key, keyIndex) => (
                          <span key={key} className="flex items-center gap-1">
                            {keyIndex > 0 && <span aria-hidden className="text-xs text-[#585868]">+</span>}
                            <kbd className="rounded-md border border-[#767676] bg-[#f3f4f6] px-1.5 py-0.5 font-sans text-xs font-medium text-[#0a0a0a]">
                              {key}
                            </kbd>
                          </span>
                        ))}
                      </span>
                    ))}
                  </dt>
                  <dd className="text-sm text-[#0a0a0a]">{row.description}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-[#0a0a0a]">Accessibility features</h3>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-[#0a0a0a]">
            <li>
              <strong className="font-medium">Jump to…</strong> is hidden until you press Tab once at the top of
              the page. Open it with Enter, Space or ↓, then choose filters, the board, a column or Uncategorized.
            </li>
            <li>
              <strong className="font-medium">Reduce motion</strong> in the Options menu simplifies the confetti
              to one small burst, limits how far a grabbed card can lean, and turns off other animations.
              It starts from your system setting.
            </li>
            <li>Moves, deletions and filter results are announced to screen readers.</li>
            <li>Notifications stay on screen until you dismiss them.</li>
          </ul>
        </section>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] bg-[#0369a1] px-4 py-2.5 text-sm font-medium text-white"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

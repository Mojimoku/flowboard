import { useMenu } from '../hooks/useMenu';
import type { BoardColumn } from '../types';

interface LandmarksMenuProps {
  columns: BoardColumn[];
}

interface Target {
  label: string;
  selector: string;
}

/**
 * Keyboard-only "skip to" menu. It is the first Tab stop on the page and stays
 * invisible (but focusable) until it receives focus.
 */
export function LandmarksMenu({ columns }: LandmarksMenuProps) {
  const { open, rootRef, triggerProps, listProps, closeMenu } = useMenu();

  const targets: Target[] = [
    { label: 'Search and filters', selector: '#filters' },
    { label: 'Board (all columns)', selector: '#board' },
    ...columns.map((column) => ({
      label: `${column.title} column`,
      selector: `[data-column-id="${CSS.escape(column.id)}"] h2`,
    })),
    { label: 'Uncategorized', selector: '#uncategorized-heading' },
  ];

  function jumpTo(selector: string) {
    closeMenu(false);
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return;
    element.focus();
    element.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed left-2 top-2 z-[10002] opacity-0 focus-within:pointer-events-auto focus-within:opacity-100"
    >
      <button
        {...triggerProps}
        type="button"
        aria-controls={open ? 'landmarks-list' : undefined}
        className="rounded-[10px] border border-[#767676] bg-white px-3 py-2 text-sm font-medium text-[#0a0a0a] shadow-lg"
      >
        Jump to…
      </button>
      {open && (
        <ul
          {...listProps}
          id="landmarks-list"
          aria-label="Jump to"
          className="absolute left-0 top-full mt-1 max-h-[70vh] w-60 list-none overflow-y-auto rounded-[10px] border border-[#767676] bg-white py-1 shadow-lg"
        >
          {targets.map((target) => (
            <li key={target.selector} role="none">
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                onClick={() => jumpTo(target.selector)}
                className="block w-full px-3 py-1.5 text-left text-sm text-[#0a0a0a] hover:bg-black/5 focus:bg-black/10"
              >
                {target.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

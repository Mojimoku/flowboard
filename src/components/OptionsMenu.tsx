import { useMenu } from '../hooks/useMenu';

interface OptionsMenuProps {
  reduceMotion: boolean;
  onToggleReduceMotion: () => void;
  onOpenShortcuts: () => void;
}

export function OptionsMenu({ reduceMotion, onToggleReduceMotion, onOpenShortcuts }: OptionsMenuProps) {
  const { open, rootRef, triggerProps, listProps, closeMenu } = useMenu();

  return (
    <div ref={rootRef} className="relative">
      <button
        {...triggerProps}
        type="button"
        aria-controls={open ? 'options-list' : undefined}
        className="flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 font-medium text-[#0a0a0a] hover:bg-black/5"
      >
        Options
        <span aria-hidden className="text-xs">
          ▾
        </span>
      </button>
      {open && (
        <ul
          {...listProps}
          id="options-list"
          aria-label="Options"
          className="absolute right-0 top-10 z-30 w-64 list-none rounded-[10px] border border-black/10 bg-white py-1 shadow-lg"
        >
          <li role="none">
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={reduceMotion}
              tabIndex={-1}
              onClick={onToggleReduceMotion}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-[#0a0a0a] hover:bg-black/5 focus:bg-black/10"
            >
              Reduce motion
              <span className="text-xs font-medium text-[#585868]">{reduceMotion ? 'On' : 'Off'}</span>
            </button>
          </li>
          <li role="none">
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-keyshortcuts="Control+/ Meta+/"
              onClick={() => {
                closeMenu(true);
                onOpenShortcuts();
              }}
              className="block w-full px-3 py-2 text-left text-sm text-[#0a0a0a] hover:bg-black/5 focus:bg-black/10"
            >
              Keyboard shortcuts…
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

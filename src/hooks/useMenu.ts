import { useCallback, useEffect, useRef, useState } from 'react';

const ITEM_SELECTOR =
  '[role="menuitem"]:not([disabled]), [role="menuitemcheckbox"]:not([disabled])';

/**
 * WAI-ARIA menu button behaviour: Enter/Space/↓ open on the first item, ↑ opens on the last,
 * ↑/↓ move through items and wrap around at either end, Home/End jump, Esc closes and
 * returns focus to the button, Tab closes, and clicking elsewhere closes.
 */
export function useMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLElement>(null);
  const pendingFocus = useRef<'first' | 'last' | null>(null);

  const items = useCallback(
    () => Array.from(listRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []),
    [],
  );

  useEffect(() => {
    if (!open || !pendingFocus.current) return;
    const list = items();
    (pendingFocus.current === 'last' ? list[list.length - 1] : list[0])?.focus();
    pendingFocus.current = null;
  }, [open, items]);

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function openMenu(which: 'first' | 'last' = 'first') {
    pendingFocus.current = which;
    setOpen(true);
  }

  /** Close the menu. Pass `false` when the chosen action moves focus somewhere else itself. */
  function closeMenu(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  const triggerProps = {
    ref: triggerRef,
    'aria-haspopup': 'menu' as const,
    'aria-expanded': open,
    onClick: () => (open ? closeMenu(false) : openMenu('first')),
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        openMenu('first');
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        openMenu('last');
      }
    },
  };

  const listProps = {
    ref: listRef as React.RefObject<never>,
    role: 'menu' as const,
    onKeyDown: (event: React.KeyboardEvent) => {
      const list = items();
      if (list.length === 0) return;
      const index = list.indexOf(document.activeElement as HTMLElement);
      const focus = (target: number) => {
        event.preventDefault();
        list[(target + list.length) % list.length].focus();
      };
      switch (event.key) {
        case 'ArrowDown':
          focus(index + 1);
          break;
        case 'ArrowUp':
          focus(index - 1);
          break;
        case 'Home':
          focus(0);
          break;
        case 'End':
          focus(list.length - 1);
          break;
        case 'Tab':
          // Hand focus back to the button so the browser tabs on from there.
          setOpen(false);
          triggerRef.current?.focus();
          break;
      }
    },
  };

  return { open, rootRef, triggerProps, listProps, openMenu, closeMenu };
}

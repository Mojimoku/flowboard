import { useId } from 'react';
import { useDialog } from '../hooks/useDialog';

interface IncinerateDialogProps {
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export function IncinerateDialog({ count, onCancel, onConfirm }: IncinerateDialogProps) {
  const dialogRef = useDialog<HTMLDivElement>(onCancel);
  const titleId = useId();
  const descId = useId();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="flex w-full max-w-[420px] flex-col gap-6 rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col gap-2">
          <h2 id={titleId} className="text-lg font-medium text-[#0a0a0a]">Incinerate uncategorized cards?</h2>
          <p id={descId} className="text-sm text-[#585868]">
            This will permanently delete all {count} uncategorized{' '}
            {count === 1 ? 'card' : 'cards'}. This can&rsquo;t be undone.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            data-autofocus
            className="rounded-[10px] px-4 py-2.5 text-sm font-medium text-[#0a0a0a] hover:bg-black/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-[10px] bg-[#b62400] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#9c1f00]"
          >
            This is fine
          </button>
        </div>
      </div>
    </div>
  );
}

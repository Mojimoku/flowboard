import { useId, useState } from 'react';
import { PRIORITIES } from '../constants';
import { useDialog } from '../hooks/useDialog';
import { UNCATEGORIZED, type BoardColumn, type Card, type CardInput, type ColumnId, type Priority } from '../types';

export type CardModalState =
  | { mode: 'add'; columnId: Card['columnId'] }
  | { mode: 'edit'; card: Card };

interface CardModalProps {
  state: CardModalState;
  columns: BoardColumn[];
  onSave: (input: CardInput, columnId: ColumnId) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function CardModal({ state, columns, onSave, onDelete, onClose }: CardModalProps) {
  const dialogRef = useDialog<HTMLDivElement>(onClose);
  const titleId = useId();
  const initial = state.mode === 'edit' ? state.card : null;

  const [title, setTitle] = useState(initial?.title ?? '');
  const [assignee, setAssignee] = useState(initial?.assignee ?? '');
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'Medium');
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '');
  const [columnId, setColumnId] = useState<ColumnId>(
    state.mode === 'edit' ? state.card.columnId : state.columnId,
  );
  const [showError, setShowError] = useState(false);

  const isValid = title.trim() !== '' && assignee.trim() !== '' && dueDate !== '';

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValid) {
      setShowError(true);
      return;
    }
    onSave({ title: title.trim(), assignee: assignee.trim(), priority, dueDate }, columnId);
  }

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
        className="flex w-full max-w-[512px] flex-col gap-6 rounded-2xl bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-medium text-[#0a0a0a]">
            {state.mode === 'add' ? 'Add card' : 'Edit card'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-1.5 flex h-9 w-9 items-center justify-center rounded-[10px] text-xl text-[#585868] hover:bg-black/5 hover:text-[#0a0a0a]"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <p className="text-xs text-[#585868]">All fields are required.</p>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[#0a0a0a]">Title</span>
            <input
              type="text"
              required
              aria-required
              data-autofocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Enter card title..."
              className="rounded-[10px] border border-[#767676] px-3 py-2.5 text-sm text-[#0a0a0a] focus:border-[#0369a1] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0369a1]"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[#585868]">
              Assignee
            </span>
            <input
              type="text"
              required
              aria-required
              value={assignee}
              onChange={(event) => setAssignee(event.target.value)}
              placeholder="e.g. Jane Doe"
              className="rounded-[10px] border border-[#767676] px-3 py-2.5 text-sm text-[#0a0a0a] focus:border-[#0369a1] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0369a1]"
            />
          </label>

          <div className="flex gap-6">
            <label className="flex flex-1 flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-[#585868]">
                Priority
              </span>
              <select
                required
                aria-required
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
                className="rounded-[10px] border border-[#767676] px-3 py-2.5 text-sm text-[#0a0a0a] focus:border-[#0369a1] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0369a1]"
              >
                {PRIORITIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-1 flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-[#585868]">
                Due Date
              </span>
              <input
                type="date"
                required
                aria-required
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="rounded-[10px] border border-[#767676] px-3 py-2.5 text-sm text-[#0a0a0a] focus:border-[#0369a1] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0369a1]"
              />
            </label>
          </div>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[#585868]">
              Column
            </span>
            <select
              value={columnId}
              onChange={(event) => setColumnId(event.target.value)}
              className="rounded-[10px] border border-[#767676] px-3 py-2.5 text-sm text-[#0a0a0a] focus:border-[#0369a1] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0369a1]"
            >
              {columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.title}
                </option>
              ))}
              <option value={UNCATEGORIZED}>Uncategorized</option>
            </select>
          </label>

          {showError && !isValid && (
            <p role="alert" className="text-sm text-[#d4183d]">
              Please fill in the title, assignee and due date.
            </p>
          )}

          <div className="flex items-center justify-between border-t border-black/10 pt-4">
            {state.mode === 'edit' ? (
              <button
                type="button"
                onClick={() => onDelete(state.card.id)}
                className="text-sm font-medium text-[#d4183d] hover:underline"
              >
                Delete card
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[10px] px-4 py-2.5 text-sm font-medium text-[#0a0a0a] hover:bg-black/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-[10px] bg-[#0369a1] px-4 py-2.5 text-sm font-medium text-white"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

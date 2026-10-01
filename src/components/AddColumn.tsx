import { useState } from 'react';

interface AddColumnProps {
  onAdd: (title: string) => void;
}

export function AddColumn({ onAdd }: AddColumnProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');

  function submit() {
    if (title.trim()) onAdd(title);
    setTitle('');
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex h-12 w-[280px] shrink-0 items-center gap-2 rounded-[10px] border-2 border-dashed border-black/10 px-4 text-sm font-medium text-[#585868] hover:border-black/20 hover:text-[#0a0a0a]"
      >
        <span aria-hidden>+</span>
        Add column
      </button>
    );
  }

  return (
    <div className="flex w-[280px] shrink-0 flex-col gap-2 self-start rounded-[10px] bg-[#f3f4f6] p-3">
      <input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit();
          if (event.key === 'Escape') {
            setTitle('');
            setEditing(false);
          }
        }}
        aria-label="New column name"
        placeholder="Column name…"
        className="rounded-[10px] border border-[#767676] bg-white px-3 py-2 text-sm focus:border-[#0369a1] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0369a1]"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={!title.trim()}
          className="rounded-[10px] bg-[#0369a1] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            setTitle('');
            setEditing(false);
          }}
          className="rounded-[10px] px-3 py-1.5 text-sm font-medium hover:bg-black/5"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

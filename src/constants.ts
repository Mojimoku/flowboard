import type { BoardColumn, Priority } from './types';

/** Seeded for a user the first time they open the board. */
export const DEFAULT_COLUMNS: BoardColumn[] = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'in-review', title: 'In Review' },
  { id: 'done', title: 'Done' },
];

export const PRIORITIES: Priority[] = ['High', 'Medium', 'Low'];

export const PRIORITY_STYLES: Record<Priority, string> = {
  High: 'bg-red-50 text-red-700 border border-red-200',
  Medium: 'bg-amber-50 text-amber-700 border border-amber-200',
  Low: 'bg-green-50 text-green-700 border border-green-200',
};

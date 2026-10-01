export type Priority = 'High' | 'Medium' | 'Low';

export type ColumnId = string;

export const UNCATEGORIZED: ColumnId = 'uncategorized';

export interface BoardColumn {
  id: ColumnId;
  title: string;
}

export interface Card {
  id: string;
  title: string;
  assignee: string;
  priority: Priority;
  dueDate: string;
  columnId: ColumnId;
}

export type CardInput = Omit<Card, 'id' | 'columnId'>;

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_COLUMNS } from '../constants';
import type { Card } from '../types';
import { CardModal } from './CardModal';

const card: Card = {
  id: 'a',
  title: 'Existing',
  assignee: 'Ada',
  priority: 'High',
  dueDate: '2030-01-01',
  columnId: 'backlog',
};

function renderModal(state: Parameters<typeof CardModal>[0]['state']) {
  const handlers = { onSave: vi.fn(), onDelete: vi.fn(), onClose: vi.fn() };
  render(<CardModal state={state} columns={DEFAULT_COLUMNS} {...handlers} />);
  return handlers;
}

describe('CardModal', () => {
  it('blocks saving until title, assignee and due date are filled', async () => {
    const { onSave } = renderModal({ mode: 'add', columnId: 'backlog' });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please fill in');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('trims input and saves into the chosen column', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal({ mode: 'add', columnId: 'backlog' });
    await user.type(screen.getByLabelText('Title'), '  Write tests ');
    await user.type(screen.getByLabelText('Assignee'), ' Bo ');
    fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: '2030-05-05' } });
    await user.selectOptions(screen.getByLabelText('Priority'), 'Low');
    await user.selectOptions(screen.getByLabelText('Column'), 'done');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(
      { title: 'Write tests', assignee: 'Bo', priority: 'Low', dueDate: '2030-05-05' },
      'done',
    );
  });

  it('prefills values and offers delete in edit mode', async () => {
    const { onDelete } = renderModal({ mode: 'edit', card });
    expect(screen.getByRole('heading', { name: 'Edit card' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Existing');
    await userEvent.click(screen.getByRole('button', { name: 'Delete card' }));
    expect(onDelete).toHaveBeenCalledWith('a');
  });

  it('has no delete button when adding', () => {
    renderModal({ mode: 'add', columnId: 'backlog' });
    expect(screen.queryByRole('button', { name: 'Delete card' })).not.toBeInTheDocument();
  });

  it('closes on Escape and Cancel', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal({ mode: 'add', columnId: 'backlog' });
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

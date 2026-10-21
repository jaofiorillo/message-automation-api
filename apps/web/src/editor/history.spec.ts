import type { Draft } from '../api/types';
import { createHistory, record, redo, undo } from './history';

const at = (rootContent: string): Draft => ({
  rootContent,
  contents: [],
  coordinates: {},
});

describe('history', () => {
  it('undoes and redoes changes', () => {
    let history = createHistory(at('a'));
    history = record(history, at('b'), null, 0);
    history = record(history, at('c'), null, 10);
    history = undo(history);
    expect(history.present.rootContent).toBe('b');
    history = undo(history);
    expect(history.present.rootContent).toBe('a');
    expect(undo(history)).toBe(history);
    history = redo(history);
    expect(history.present.rootContent).toBe('b');
  });

  it('collapses quick edits with the same key into one step', () => {
    let history = createHistory(at('a'));
    history = record(history, at('ab'), 'text', 0);
    history = record(history, at('abc'), 'text', 500);
    history = record(history, at('abcd'), 'text', 2000);
    expect(history.past.map((d) => d.rootContent)).toEqual(['a', 'abc']);
  });

  it('drops the redo stack on a new change', () => {
    let history = record(createHistory(at('a')), at('b'), null, 0);
    history = record(undo(history), at('c'), null, 0);
    expect(history.future).toEqual([]);
  });
});

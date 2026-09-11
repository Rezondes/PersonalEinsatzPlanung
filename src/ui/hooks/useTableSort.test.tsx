import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTableSort } from './useTableSort';

interface Row {
  id: string;
  value: number;
}

const byValue = (a: Row, b: Row) => a.value - b.value;
const byId = (a: Row, b: Row) => a.id.localeCompare(b.id);

describe('useTableSort', () => {
  it('initializes sort to the given key and default direction asc', () => {
    const { result } = renderHook(() => useTableSort<'value' | 'id'>('value'));

    expect(result.current.sort).toEqual({ key: 'value', direction: 'asc' });
  });

  it('initializes sort to the given key and explicit initial direction', () => {
    const { result } = renderHook(() => useTableSort<'value' | 'id'>('value', 'desc'));

    expect(result.current.sort).toEqual({ key: 'value', direction: 'desc' });
  });

  it('toggle on the currently active key flips direction asc -> desc', () => {
    const { result } = renderHook(() => useTableSort<'value' | 'id'>('value'));

    act(() => result.current.toggle('value'));

    expect(result.current.sort).toEqual({ key: 'value', direction: 'desc' });
  });

  it('toggle on the currently active key flips direction desc -> asc', () => {
    const { result } = renderHook(() => useTableSort<'value' | 'id'>('value', 'desc'));

    act(() => result.current.toggle('value'));

    expect(result.current.sort).toEqual({ key: 'value', direction: 'asc' });
  });

  it('toggle on a different key switches to that key with direction asc, even from a desc key', () => {
    const { result } = renderHook(() => useTableSort<'value' | 'id'>('value', 'desc'));

    act(() => result.current.toggle('id'));

    expect(result.current.sort).toEqual({ key: 'id', direction: 'asc' });
  });

  it('two toggles on the same key queued in one batch cycle the direction twice, back to asc', () => {
    const { result } = renderHook(() => useTableSort<'value' | 'id'>('value'));

    act(() => {
      result.current.toggle('value');
      result.current.toggle('value');
    });

    expect(result.current.sort).toEqual({ key: 'value', direction: 'asc' });
  });

  it('headProps reports active: true and the current direction for the active key', () => {
    const { result } = renderHook(() => useTableSort<'value' | 'id'>('value', 'desc'));

    const props = result.current.headProps('value');

    expect(props.active).toBe(true);
    expect(props.direction).toBe('desc');
  });

  it('headProps reports active: false and direction asc for an inactive key, regardless of the active key\'s own direction', () => {
    const { result } = renderHook(() => useTableSort<'value' | 'id'>('value', 'desc'));

    const props = result.current.headProps('id');

    expect(props.active).toBe(false);
    expect(props.direction).toBe('asc');
  });

  it('headProps(key).onClick calls toggle for that key', () => {
    const { result } = renderHook(() => useTableSort<'value' | 'id'>('value'));

    act(() => result.current.headProps('id').onClick());

    expect(result.current.sort).toEqual({ key: 'id', direction: 'asc' });
  });

  it('sortRows uses the comparator for the current sort key in ascending order', () => {
    const { result } = renderHook(() => useTableSort<'value' | 'id'>('value'));
    const rows: Row[] = [
      { id: 'b', value: 3 },
      { id: 'a', value: 1 },
      { id: 'c', value: 2 },
    ];

    const sorted = result.current.sortRows(rows, { value: byValue, id: byId });

    expect(sorted.map((r) => r.id)).toEqual(['a', 'c', 'b']);
  });

  it('sortRows reverses the comparator for descending order', () => {
    const { result } = renderHook(() => useTableSort<'value' | 'id'>('value', 'desc'));
    const rows: Row[] = [
      { id: 'b', value: 3 },
      { id: 'a', value: 1 },
      { id: 'c', value: 2 },
    ];

    const sorted = result.current.sortRows(rows, { value: byValue, id: byId });

    expect(sorted.map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('sortRows switches comparator when the active key changes', () => {
    const { result } = renderHook(() => useTableSort<'value' | 'id'>('value'));
    const rows: Row[] = [
      { id: 'b', value: 3 },
      { id: 'a', value: 1 },
      { id: 'c', value: 2 },
    ];

    act(() => result.current.toggle('id'));
    const sorted = result.current.sortRows(rows, { value: byValue, id: byId });

    expect(sorted.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('sortRows returns a new array and does not mutate the input array order', () => {
    const { result } = renderHook(() => useTableSort<'value' | 'id'>('value'));
    const rows: Row[] = [
      { id: 'b', value: 3 },
      { id: 'a', value: 1 },
      { id: 'c', value: 2 },
    ];
    const originalOrder = rows.map((r) => r.id);

    const sorted = result.current.sortRows(rows, { value: byValue, id: byId });

    expect(sorted).not.toBe(rows);
    expect(rows.map((r) => r.id)).toEqual(originalOrder);
  });
});

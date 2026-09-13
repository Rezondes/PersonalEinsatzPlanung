import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResponsiveDataList } from './ResponsiveDataList';

/** Same helper as src/ui/hooks/useBreakpoint.test.tsx - jsdom has no layout engine, so
 * window.matchMedia is mocked to answer as if the viewport were `width` wide. */
function mockViewportWidth(width: number) {
  window.matchMedia = ((query: string) => {
    const match = /min-width:\s*(\d+(?:\.\d+)?)px/.exec(query);
    const minWidth = match ? Number(match[1]) : 0;
    return {
      matches: width >= minWidth,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;
}

interface Row {
  id: string;
  name: string;
}

const rows: Row[] = [
  { id: '1', name: 'Nord' },
  { id: '2', name: 'Süd' },
];

function renderList(rowsToRender: Row[], emptyMessage?: string) {
  return render(
    <ResponsiveDataList
      rows={rowsToRender}
      getKey={(r) => r.id}
      renderCard={(r) => <div>Karte {r.name}</div>}
      emptyMessage={emptyMessage}
    >
      <table>
        <tbody>
          <tr>
            <td>Tabelle</td>
          </tr>
        </tbody>
      </table>
    </ResponsiveDataList>,
  );
}

describe('ResponsiveDataList', () => {
  it('renders the children (the view\'s own table) unchanged at tablet/laptop widths, ignoring rows/renderCard', () => {
    mockViewportWidth(1700);
    renderList(rows);

    expect(screen.getByText('Tabelle')).toBeInTheDocument();
    expect(screen.queryByText(/Karte/)).not.toBeInTheDocument();
  });

  it('renders one card per row via renderCard on mobile, not the table', () => {
    mockViewportWidth(500);
    renderList(rows);

    expect(screen.getByText('Karte Nord')).toBeInTheDocument();
    expect(screen.getByText('Karte Süd')).toBeInTheDocument();
    expect(screen.queryByText('Tabelle')).not.toBeInTheDocument();
  });

  it('shows emptyMessage instead of any cards on mobile when rows is empty', () => {
    mockViewportWidth(500);
    renderList([], 'Noch keine Filiale angelegt.');

    expect(screen.getByText('Noch keine Filiale angelegt.')).toBeInTheDocument();
    expect(screen.queryByText('Tabelle')).not.toBeInTheDocument();
  });

  it('still renders the table (not emptyMessage) when rows is empty but the layout is not mobile', () => {
    mockViewportWidth(1700);
    renderList([], 'Noch keine Filiale angelegt.');

    expect(screen.getByText('Tabelle')).toBeInTheDocument();
    expect(screen.queryByText('Noch keine Filiale angelegt.')).not.toBeInTheDocument();
  });
});

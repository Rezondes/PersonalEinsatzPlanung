import type { ReactNode } from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useBreakpoint } from '@ui/hooks/useBreakpoint';

interface ResponsiveDataListProps<T> {
  rows: T[];
  getKey: (row: T) => string;
  renderCard: (row: T) => ReactNode;
  emptyMessage?: ReactNode;
  /** The view's own table markup, rendered unchanged at tablet and laptop. */
  children: ReactNode;
}

/**
 * The mobile/non-mobile switch for a list view: cards on mobile, the view's own table (sticky
 * first column at tablet, unchanged at laptop) everywhere else. Each view keeps authoring its own
 * table AND its own card markup by hand - their content differs too much (a Filiale card isn't
 * shaped like a Mitarbeiter card) for a generic renderer to help there; this component only owns
 * the breakpoint switch itself. Long-press wiring is `useLongPress`, used inside `renderCard`.
 */
export function ResponsiveDataList<T>({ rows, getKey, renderCard, emptyMessage, children }: ResponsiveDataListProps<T>) {
  const layout = useBreakpoint();

  if (layout !== 'mobile') {
    return <>{children}</>;
  }

  if (rows.length === 0 && emptyMessage) {
    return (
      <Typography color="text.secondary" sx={{ py: 2 }}>
        {emptyMessage}
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      {rows.map((row) => (
        <div key={getKey(row)}>{renderCard(row)}</div>
      ))}
    </Stack>
  );
}

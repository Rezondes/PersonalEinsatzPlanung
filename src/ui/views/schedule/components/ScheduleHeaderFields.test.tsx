import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BranchId } from '@domain/shared/ids';
import { createWeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import { services } from '@infrastructure/services';
import { ScheduleHeaderFields } from './ScheduleHeaderFields';

vi.mock('@infrastructure/services', () => ({
  services: { schedule: { save: vi.fn() } },
}));

const saveMock = vi.mocked(services.schedule.save);
const branchId = 'b1' as BranchId;

function schedule(overrides: Partial<WeeklySchedule> = {}): WeeklySchedule {
  return { ...createWeeklySchedule(branchId, { year: 2026, week: 37 }, []), ...overrides };
}

function revenueField() {
  return screen.getByRole('textbox', { name: 'Geplanter Wochenumsatz' });
}

function hoursField() {
  return screen.getByRole('textbox', { name: 'Geplante Wochenstunden' });
}

describe('ScheduleHeaderFields', () => {
  beforeEach(() => {
    saveMock.mockReset();
    saveMock.mockImplementation(async (s) => ({ ...s, updatedAt: '2026-09-08T00:00:00.000Z' }));
  });

  it('shows the planned values of the schedule in German notation', () => {
    render(
      <ScheduleHeaderFields
        schedule={schedule({ plannedWeeklyRevenue: 25000, plannedWeeklyHours: 37.5 })}
        onSaved={() => {}}
        onError={() => {}}
      />,
    );

    expect(revenueField()).toHaveValue('25000');
    expect(hoursField()).toHaveValue('37,5');
  });

  it('saves both values on blur and hands the saved schedule back', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<ScheduleHeaderFields schedule={schedule({ plannedWeeklyHours: 40 })} onSaved={onSaved} onError={() => {}} />);

    await user.type(revenueField(), '25000');
    await user.tab();

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ plannedWeeklyRevenue: 25000, plannedWeeklyHours: 40 }));
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ plannedWeeklyRevenue: 25000, plannedWeeklyHours: 40 }));
    expect(await screen.findByRole('status')).toHaveTextContent('Gespeichert');
  });

  it('reports a failed save with context instead of showing "Gespeichert"', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    saveMock.mockRejectedValue(new Error('IndexedDB nicht verfügbar'));
    render(<ScheduleHeaderFields schedule={schedule()} onSaved={() => {}} onError={onError} />);

    await user.type(hoursField(), '38');
    await user.tab();

    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(expect.any(Error), 'Kopfdaten konnten nicht gespeichert werden'),
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('re-syncs its drafts when a different schedule is shown', () => {
    const first = schedule({ plannedWeeklyRevenue: 25000 });
    const { rerender } = render(<ScheduleHeaderFields schedule={first} onSaved={() => {}} onError={() => {}} />);

    rerender(<ScheduleHeaderFields schedule={schedule({ plannedWeeklyRevenue: 18000 })} onSaved={() => {}} onError={() => {}} />);

    expect(revenueField()).toHaveValue('18000');
  });

  it('does not save while no schedule is loaded', async () => {
    const user = userEvent.setup();
    render(<ScheduleHeaderFields schedule={null} onSaved={() => {}} onError={() => {}} />);

    await user.click(revenueField());
    await user.tab();

    expect(saveMock).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { BranchId, EmployeeId } from '@domain/shared/ids';
import { createWeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { WeeklySchedule } from '@domain/schedule/WeeklySchedule';
import type { Branch } from '@domain/branch/Branch';
import type { Employee } from '@domain/employee/Employee';
import { fullName } from '@domain/employee/Employee';
import { services } from '@infrastructure/services';
import { PrintPreviewView } from './PrintPreviewView';
import { useNotificationStore } from '@ui/app/store/notificationStore';

vi.mock('@infrastructure/services', () => ({
  services: {
    schedule: { find: vi.fn() },
    branch: { find: vi.fn() },
    employee: { forBranch: vi.fn() },
    absence: { forEmployees: vi.fn() },
  },
}));

const scheduleFindMock = vi.mocked(services.schedule.find);
const branchFindMock = vi.mocked(services.branch.find);
const employeeForBranchMock = vi.mocked(services.employee.forBranch);
const absenceForBranchMock = vi.mocked(services.absence.forEmployees);

const branchId = 'branch-1' as BranchId;
const cw = { year: 2026, week: 37 };

function makeBranch(overrides: Partial<Branch> = {}): Branch {
  return {
    id: branchId,
    name: 'Filiale Nord',
    branchNumber: '001',
    address: { street: 'Hauptstraße', houseNumber: '12', postalCode: '30159', city: 'Hannover' },
    logoBase64: null,
    federalState: 'Niedersachsen',
    allowedOpenSundays: [],
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeEmployee(id: EmployeeId, lastName: string, overrides: Partial<Employee> = {}): Employee {
  return {
    id,
    branchId,
    lastName,
    firstName: 'Anna',
    jobTitle: 'Verkauf',
    employmentType: { type: 'PartTime', weeklyHours: 30 },
    vacationEntitlementPerYear: 30,
    holidayVacationHours: 5,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeSchedule(employeeIds: EmployeeId[]): WeeklySchedule {
  return createWeeklySchedule(branchId, cw, employeeIds);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderPrintPreview(initialEntries: string[], initialIndex = initialEntries.length - 1) {
  return render(
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
      <Routes>
        <Route path="/before" element={<div>Zurück-Ziel</div>} />
        <Route path="/de/schedule" element={<div>Wochenplan-Ziel</div>} />
        <Route path="/print" element={<PrintPreviewView />} />
        <Route path="/print/:scheduleId" element={<PrintPreviewView />} />
      </Routes>
    </MemoryRouter>,
  );
}

const FULL_PART_TIME_TITLE = 'Personaleinsatzplanung (PEP): Voll- und Teilzeitkräfte (Aufbewahrungsfrist: nur aktueller Monat)';
const MINIJOB_TITLE = 'Personaleinsatzplanung (PEP): geringfügig Beschäftigte (Aufbewahrungsfrist: 2 Jahre)';

describe('PrintPreviewView', () => {
  beforeEach(() => {
    scheduleFindMock.mockReset();
    branchFindMock.mockReset();
    employeeForBranchMock.mockReset();
    absenceForBranchMock.mockReset();
    employeeForBranchMock.mockResolvedValue([]);
    absenceForBranchMock.mockResolvedValue([]);
    window.print = vi.fn();
    useNotificationStore.getState().clear();
  });

  it('shows a loading state while the fetch is pending', () => {
    const { promise } = deferred<WeeklySchedule | null>();
    scheduleFindMock.mockReturnValue(promise);

    renderPrintPreview(['/print/s1']);

    expect(screen.getByRole('status')).toHaveTextContent('Wochenplan wird geladen…');
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('clears loading and shows the not-found alert without calling any service when no scheduleId is present', async () => {
    renderPrintPreview(['/print']);

    await waitFor(() => expect(screen.queryByText('Wochenplan wird geladen…')).not.toBeInTheDocument());
    expect(screen.getByText('Wochenplan konnte nicht gefunden werden.')).toBeInTheDocument();
    expect(scheduleFindMock).not.toHaveBeenCalled();
    expect(branchFindMock).not.toHaveBeenCalled();
    expect(employeeForBranchMock).not.toHaveBeenCalled();
    expect(absenceForBranchMock).not.toHaveBeenCalled();
  });

  it('shows the not-found alert when the schedule genuinely does not exist', async () => {
    scheduleFindMock.mockResolvedValue(null);

    renderPrintPreview(['/print/s1']);

    expect(await screen.findByText('Wochenplan konnte nicht gefunden werden.')).toBeInTheDocument();
    expect(branchFindMock).not.toHaveBeenCalled();
  });

  // Teil 8, Package 9: a rejected fetch used to be swallowed and shown as "nicht gefunden", sending
  // the user looking for a plan that exists.
  it('reports a rejected fetch as a load failure, not as not-found, without staying stuck loading', async () => {
    scheduleFindMock.mockResolvedValue(makeSchedule([]));
    branchFindMock.mockRejectedValue(new Error('IndexedDB nicht verfügbar'));

    renderPrintPreview(['/print/s1']);

    expect(await screen.findByText('Wochenplan konnte nicht geladen werden.')).toBeInTheDocument();
    expect(screen.queryByText('Wochenplan konnte nicht gefunden werden.')).not.toBeInTheDocument();
    expect(screen.queryByText('Wochenplan wird geladen…')).not.toBeInTheDocument();
    expect(useNotificationStore.getState().queue).toEqual([
      expect.objectContaining({ severity: 'error', text: expect.stringContaining('IndexedDB nicht verfügbar') }),
    ]);
  });

  // Teil 8, Package 9: the print route has no app navigation, so a bare alert was a dead end in the
  // installed app (no browser back button).
  it('offers a way back to the Wochenplanung when the plan is not found', async () => {
    const user = userEvent.setup();
    scheduleFindMock.mockResolvedValue(null);
    renderPrintPreview(['/print/s1']);

    await user.click(await screen.findByRole('button', { name: 'Zur Wochenplanung' }));

    expect(screen.getByText('Wochenplan-Ziel')).toBeInTheDocument();
  });

  it('offers a way back to the Wochenplanung when loading failed', async () => {
    scheduleFindMock.mockRejectedValue(new Error('boom'));
    renderPrintPreview(['/print/s1']);

    expect(await screen.findByRole('button', { name: 'Zur Wochenplanung' })).toBeInTheDocument();
  });

  it('paginates full-/part-time employees into sheets of 9, each sheet showing the correct employees in order, and renders one MinijobForm sheet for the Minijob employee', async () => {
    const fullPartTimeIds = Array.from({ length: 11 }, (_, i) => `fpt-${i}` as EmployeeId);
    const minijobId = 'mj-1' as EmployeeId;
    const fullPartTimeEmployees = fullPartTimeIds.map((id, i) =>
      makeEmployee(id, `Mitarbeiter${String(i).padStart(2, '0')}`),
    );
    const employees = [
      ...fullPartTimeEmployees,
      makeEmployee(minijobId, 'Zimmermann', { employmentType: { type: 'Minijob', minHours: 10, maxHours: 40 } }),
    ];

    scheduleFindMock.mockResolvedValue(makeSchedule([...fullPartTimeIds, minijobId]));
    branchFindMock.mockResolvedValue(makeBranch());
    employeeForBranchMock.mockResolvedValue(employees);

    const { container } = renderPrintPreview(['/print/s1']);

    await waitFor(() => expect(screen.getAllByText(FULL_PART_TIME_TITLE)).toHaveLength(2));
    expect(screen.getAllByText(MINIJOB_TITLE)).toHaveLength(1);

    const fullPartTimePages = Array.from(container.querySelectorAll('.print-page')).filter(
      (page) => within(page as HTMLElement).queryAllByText(FULL_PART_TIME_TITLE).length > 0,
    );
    expect(fullPartTimePages).toHaveLength(2);

    const namesOnPage = (page: Element) =>
      Array.from(page.querySelectorAll('th.employee-header:not(.column-branch)')).map((th) => th.textContent);

    expect(namesOnPage(fullPartTimePages[0])).toEqual(fullPartTimeEmployees.slice(0, 9).map((e) => fullName(e)));
    expect(namesOnPage(fullPartTimePages[1])).toEqual([
      ...fullPartTimeEmployees.slice(9, 11).map((e) => fullName(e)),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]);
  });

  it('renders exactly one sheet for exactly 9 full-/part-time employees, no trailing empty sheet', async () => {
    const fullPartTimeIds = Array.from({ length: 9 }, (_, i) => `fpt-${i}` as EmployeeId);
    const employees = fullPartTimeIds.map((id, i) => makeEmployee(id, `Mitarbeiter${String(i).padStart(2, '0')}`));

    scheduleFindMock.mockResolvedValue(makeSchedule(fullPartTimeIds));
    branchFindMock.mockResolvedValue(makeBranch());
    employeeForBranchMock.mockResolvedValue(employees);

    renderPrintPreview(['/print/s1']);

    await waitFor(() => expect(screen.getAllByText(FULL_PART_TIME_TITLE)).toHaveLength(1));
    expect(screen.queryAllByText(MINIJOB_TITLE)).toHaveLength(0);
  });

  it('"Drucken" calls window.print', async () => {
    scheduleFindMock.mockResolvedValue(makeSchedule([]));
    branchFindMock.mockResolvedValue(makeBranch());
    const user = userEvent.setup();

    renderPrintPreview(['/print/s1']);

    const button = await screen.findByRole('button', { name: 'Drucken' });
    await user.click(button);

    expect(window.print).toHaveBeenCalledTimes(1);
  });

  it('"Zurück" navigates back to the previous page', async () => {
    scheduleFindMock.mockResolvedValue(makeSchedule([]));
    branchFindMock.mockResolvedValue(makeBranch());
    const user = userEvent.setup();

    renderPrintPreview(['/before', '/print/s1'], 1);

    const button = await screen.findByRole('button', { name: 'Zurück' });
    await user.click(button);

    expect(await screen.findByText('Zurück-Ziel')).toBeInTheDocument();
  });

  it('gives the preview a fixed A4-landscape width via PanZoomContainer, independent of the viewport', async () => {
    scheduleFindMock.mockResolvedValue(makeSchedule([]));
    branchFindMock.mockResolvedValue(makeBranch());

    renderPrintPreview(['/print/s1']);

    const panzoomContent = await screen.findByTestId('panzoom-content');
    expect(getComputedStyle(panzoomContent).width).toBe('297mm');
  });

  it('"Drucken" still calls window.print after the preview has been zoomed/panned (AC4)', async () => {
    scheduleFindMock.mockResolvedValue(makeSchedule([]));
    branchFindMock.mockResolvedValue(makeBranch());
    const user = userEvent.setup();

    renderPrintPreview(['/print/s1']);

    const panzoomContent = await screen.findByTestId('panzoom-content');
    fireEvent.wheel(panzoomContent, { deltaY: -200 });
    fireEvent.mouseDown(panzoomContent, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 50, clientY: 50 });
    fireEvent.mouseUp(window);

    await user.click(screen.getByRole('button', { name: 'Drucken' }));

    expect(window.print).toHaveBeenCalledTimes(1);
  });
});

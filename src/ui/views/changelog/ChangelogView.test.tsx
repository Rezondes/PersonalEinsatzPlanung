import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { services } from '@infrastructure/services';
import { ChangelogView } from './ChangelogView';

vi.mock('@infrastructure/services', () => ({
  services: { changelog: { fetchChangelog: vi.fn() } },
}));

const fetchChangelogMock = vi.mocked(services.changelog.fetchChangelog);

describe('ChangelogView', () => {
  beforeEach(() => {
    fetchChangelogMock.mockReset();
  });

  it('shows a loading indicator while the releases are being fetched', () => {
    fetchChangelogMock.mockReturnValue(new Promise(() => {}));
    render(<ChangelogView />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders every release with its title, date and entries as a list', async () => {
    fetchChangelogMock.mockResolvedValue([
      {
        tagName: 'deploy-abc1234',
        title: 'Deploy 2026-09-13 10:00 UTC',
        publishedAt: '2026-09-13T10:00:00Z',
        url: 'https://github.com/Rezondes/PersonalEinsatzPlanung/releases/tag/deploy-abc1234',
        entries: ['feat(schedule): add Sonstiges templates', 'fix(month): memoize rows'],
      },
      {
        tagName: 'deploy-999',
        title: 'Deploy 2026-09-12 08:00 UTC',
        publishedAt: '2026-09-12T08:00:00Z',
        url: 'https://github.com/Rezondes/PersonalEinsatzPlanung/releases/tag/deploy-999',
        entries: ['chore: initial release'],
      },
    ]);

    render(<ChangelogView />);

    await screen.findByText('feat(schedule): add Sonstiges templates');
    expect(screen.getByText('fix(month): memoize rows')).toBeInTheDocument();
    expect(screen.getByText('chore: initial release')).toBeInTheDocument();
    expect(screen.getByText('13.09.2026')).toBeInTheDocument();
    expect(screen.getByText('12.09.2026')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: 'Auf GitHub ansehen' });
    expect(links[0]).toHaveAttribute('href', 'https://github.com/Rezondes/PersonalEinsatzPlanung/releases/tag/deploy-abc1234');
  });

  it('renders "Änderungen" as the page\'s top-level heading, with each release title one level below it (N26)', async () => {
    fetchChangelogMock.mockResolvedValue([
      {
        tagName: 'deploy-abc1234',
        title: 'Deploy 2026-09-13 10:00 UTC',
        publishedAt: '2026-09-13T10:00:00Z',
        url: 'https://github.com/Rezondes/PersonalEinsatzPlanung/releases/tag/deploy-abc1234',
        entries: ['chore: initial release'],
      },
    ]);

    render(<ChangelogView />);

    expect(screen.getByRole('heading', { level: 1, name: 'Änderungen' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: 'Deploy 2026-09-13 10:00 UTC' })).toBeInTheDocument();
  });

  it('renders releases in the order fetchChangelog provides, even when unsorted', async () => {
    // Regression guard: ChangelogView itself must never re-sort - if fetchChangelog's own sort
    // (see githubReleases.test.ts) is ever moved/removed, this should fail, not silently hide it.
    fetchChangelogMock.mockResolvedValue([
      {
        tagName: 'deploy-early',
        title: 'Deploy 2026-09-14 01:36 UTC',
        publishedAt: '2026-09-14T01:36:00Z',
        url: 'https://example.invalid/deploy-early',
        entries: ['chore: first'],
      },
      {
        tagName: 'deploy-latest',
        title: 'Deploy 2026-09-14 18:34 UTC',
        publishedAt: '2026-09-14T18:34:00Z',
        url: 'https://example.invalid/deploy-latest',
        entries: ['chore: third'],
      },
      {
        tagName: 'deploy-middle',
        title: 'Deploy 2026-09-14 17:27 UTC',
        publishedAt: '2026-09-14T17:27:00Z',
        url: 'https://example.invalid/deploy-middle',
        entries: ['chore: second'],
      },
    ]);

    render(<ChangelogView />);

    const headings = await screen.findAllByRole('heading', { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual([
      'Deploy 2026-09-14 01:36 UTC',
      'Deploy 2026-09-14 18:34 UTC',
      'Deploy 2026-09-14 17:27 UTC',
    ]);
  });

  it('shows an empty message when there are no releases yet, without crashing', async () => {
    fetchChangelogMock.mockResolvedValue([]);
    render(<ChangelogView />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.getByText('Noch keine Einträge vorhanden.')).toBeInTheDocument();
  });

  function summaryFor(title: string): HTMLElement {
    const heading = screen.getByText(title);
    const summary = heading.closest('.MuiAccordionSummary-root');
    if (!summary) throw new Error(`no AccordionSummary ancestor found for "${title}"`);
    return summary as HTMLElement;
  }

  it('expands the newest release by default, others stay collapsed', async () => {
    fetchChangelogMock.mockResolvedValue([
      {
        tagName: 'deploy-3',
        title: 'Deploy 3 (newest)',
        publishedAt: '2026-09-14T00:00:00Z',
        url: 'https://example.invalid/3',
        entries: ['chore: third'],
      },
      {
        tagName: 'deploy-2',
        title: 'Deploy 2',
        publishedAt: '2026-09-13T00:00:00Z',
        url: 'https://example.invalid/2',
        entries: ['chore: second'],
      },
      {
        tagName: 'deploy-1',
        title: 'Deploy 1',
        publishedAt: '2026-09-12T00:00:00Z',
        url: 'https://example.invalid/1',
        entries: ['chore: first'],
      },
    ]);

    render(<ChangelogView />);

    await screen.findByText('Deploy 3 (newest)');
    expect(summaryFor('Deploy 3 (newest)')).toHaveAttribute('aria-expanded', 'true');
    expect(summaryFor('Deploy 2')).toHaveAttribute('aria-expanded', 'false');
    expect(summaryFor('Deploy 1')).toHaveAttribute('aria-expanded', 'false');
  });

  it('expanding a second release leaves the first one open', async () => {
    const user = userEvent.setup();
    fetchChangelogMock.mockResolvedValue([
      {
        tagName: 'deploy-2',
        title: 'Deploy 2 (newest)',
        publishedAt: '2026-09-13T00:00:00Z',
        url: 'https://example.invalid/2',
        entries: ['chore: second'],
      },
      {
        tagName: 'deploy-1',
        title: 'Deploy 1',
        publishedAt: '2026-09-12T00:00:00Z',
        url: 'https://example.invalid/1',
        entries: ['chore: first'],
      },
    ]);

    render(<ChangelogView />);
    await screen.findByText('Deploy 2 (newest)');

    await user.click(summaryFor('Deploy 1'));

    expect(summaryFor('Deploy 1')).toHaveAttribute('aria-expanded', 'true');
    expect(summaryFor('Deploy 2 (newest)')).toHaveAttribute('aria-expanded', 'true');
  });
});

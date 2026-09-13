import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

  it('shows an empty message when there are no releases yet, without crashing', async () => {
    fetchChangelogMock.mockResolvedValue([]);
    render(<ChangelogView />);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.getByText('Noch keine Einträge vorhanden.')).toBeInTheDocument();
  });
});

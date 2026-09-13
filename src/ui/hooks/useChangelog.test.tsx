import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { services } from '@infrastructure/services';
import { useChangelog } from './useChangelog';

vi.mock('@infrastructure/services', () => ({
  services: { changelog: { fetchChangelog: vi.fn() } },
}));

const fetchChangelogMock = vi.mocked(services.changelog.fetchChangelog);

describe('useChangelog', () => {
  beforeEach(() => {
    fetchChangelogMock.mockReset();
  });

  it('calls services.changelog.fetchChangelog once on mount and exposes the resolved releases', async () => {
    const releases = [
      { tagName: 't1', title: 'Deploy 1', publishedAt: '2026-09-13T00:00:00Z', url: 'https://x', entries: ['a'] },
    ];
    fetchChangelogMock.mockResolvedValue(releases);

    const { result } = renderHook(() => useChangelog());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.releases).toEqual(releases);
    expect(fetchChangelogMock).toHaveBeenCalledTimes(1);
  });

  it('starts with an empty list and reload() re-fetches', async () => {
    fetchChangelogMock.mockResolvedValue([]);
    const { result } = renderHook(() => useChangelog());
    await waitFor(() => expect(result.current.loading).toBe(false));

    fetchChangelogMock.mockResolvedValue([
      { tagName: 't2', title: 'Deploy 2', publishedAt: '2026-09-13T00:00:00Z', url: 'https://x', entries: [] },
    ]);
    await result.current.reload();

    await waitFor(() => expect(result.current.releases).toHaveLength(1));
    expect(fetchChangelogMock).toHaveBeenCalledTimes(2);
  });
});

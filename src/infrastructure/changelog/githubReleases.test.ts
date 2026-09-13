import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchChangelog } from './githubReleases';

function mockFetchOnce(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchChangelog', () => {
  it('maps the GitHub releases API response into ChangelogRelease entries, newest first as returned', async () => {
    mockFetchOnce(200, [
      {
        tag_name: 'deploy-abc1234',
        name: 'Deploy 2026-09-13 10:00 UTC',
        body: '- feat(schedule): add Sonstiges templates (abc1234)\n- fix(month): memoize rows (def5678)',
        published_at: '2026-09-13T10:00:00Z',
        html_url: 'https://github.com/Rezondes/PersonalEinsatzPlanung/releases/tag/deploy-abc1234',
      },
      {
        tag_name: 'deploy-9990000',
        name: 'Deploy 2026-09-12 08:00 UTC',
        body: '- chore: initial release',
        published_at: '2026-09-12T08:00:00Z',
        html_url: 'https://github.com/Rezondes/PersonalEinsatzPlanung/releases/tag/deploy-9990000',
      },
    ]);

    const releases = await fetchChangelog();

    expect(releases).toHaveLength(2);
    expect(releases[0]).toEqual({
      tagName: 'deploy-abc1234',
      title: 'Deploy 2026-09-13 10:00 UTC',
      publishedAt: '2026-09-13T10:00:00Z',
      url: 'https://github.com/Rezondes/PersonalEinsatzPlanung/releases/tag/deploy-abc1234',
      entries: ['feat(schedule): add Sonstiges templates (abc1234)', 'fix(month): memoize rows (def5678)'],
    });
  });

  it('falls back to the raw body as a single entry when a line does not start with "- "', async () => {
    mockFetchOnce(200, [
      {
        tag_name: 't1',
        name: 'Deploy',
        body: 'Erstveröffentlichung.',
        published_at: '2026-09-01T00:00:00Z',
        html_url: 'https://example.invalid/t1',
      },
    ]);

    const releases = await fetchChangelog();
    expect(releases[0].entries).toEqual(['Erstveröffentlichung.']);
  });

  it('returns an empty list when the release body is empty or missing', async () => {
    mockFetchOnce(200, [
      { tag_name: 't1', name: 'Deploy', body: '', published_at: '2026-09-01T00:00:00Z', html_url: 'https://example.invalid/t1' },
    ]);
    const releases = await fetchChangelog();
    expect(releases[0].entries).toEqual([]);
  });

  it('throws a German error message on a non-ok response instead of a raw status code', async () => {
    mockFetchOnce(403, {});
    await expect(fetchChangelog()).rejects.toThrow('Änderungsliste konnte nicht geladen werden');
  });

  it('requests the fixed, hardcoded repository - no configurable/user-suppliable target', async () => {
    mockFetchOnce(200, []);
    await fetchChangelog();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'https://api.github.com/repos/Rezondes/PersonalEinsatzPlanung/releases?per_page=30',
      expect.anything(),
    );
  });
});

/**
 * Reads the project's own GitHub Releases as the in-app changelog. Every release is created by the
 * deploy workflow (.github/workflows/deploy.yml) with the commit messages since the previous
 * release as its notes - see that file for how the release itself comes to exist.
 *
 * This is the one deliberate exception (next to the optional Google Drive backup) to "the app makes
 * no request to any server on its own": reading this page always fetches
 * api.github.com, unauthenticated, read-only, no user data involved (the repository is public) -
 * see PrivacyView.tsx for the corresponding privacy-notice update. No token, no write access, no
 * cookies are ever sent.
 */

const RELEASES_URL = 'https://api.github.com/repos/Rezondes/PersonalEinsatzPlanung/releases?per_page=30';

export interface ChangelogRelease {
  tagName: string;
  title: string;
  publishedAt: string;
  url: string;
  entries: string[];
}

interface GitHubReleaseResponse {
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string;
  html_url: string;
}

/** The deploy workflow always writes one "- message (short-sha)" bullet per commit. Falls back to
 * the whole body as a single entry for anything that doesn't look like that (a hand-edited release,
 * or the very first one before this shape existed), rather than silently dropping it. */
function parseEntries(body: string | null): string[] {
  const trimmed = (body ?? '').trim();
  if (!trimmed) {
    return [];
  }
  const lines = trimmed.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.every((line) => line.startsWith('- '))) {
    return lines.map((line) => line.slice(2));
  }
  return [trimmed];
}

export async function fetchChangelog(): Promise<ChangelogRelease[]> {
  const response = await fetch(RELEASES_URL, { headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) {
    throw new Error(`Änderungsliste konnte nicht geladen werden (Fehler ${response.status}).`);
  }
  const releases = (await response.json()) as GitHubReleaseResponse[];
  return releases.map((release) => ({
    tagName: release.tag_name,
    title: release.name ?? release.tag_name,
    publishedAt: release.published_at,
    url: release.html_url,
    entries: parseEntries(release.body),
  }));
}

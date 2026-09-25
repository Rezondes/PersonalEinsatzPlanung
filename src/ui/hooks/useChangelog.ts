import { services } from '@infrastructure/services';
import { useAsyncData } from './useAsyncData';

/** The project's own deploy history, read from GitHub Releases (see
 * infrastructure/changelog/githubReleases.ts). Not scoped to a branch/selection like every other
 * data-loading hook - the changelog is the same for everyone, so it has no dependency array beyond
 * "loaded once on mount", and reload() is there purely for a manual retry button. */
export function useChangelog() {
  const { data: releases, loading, error, reload } = useAsyncData(
    [] as Awaited<ReturnType<typeof services.changelog.fetchChangelog>>,
    () => services.changelog.fetchChangelog(),
    [],
  );

  return { releases, loading, error, reload };
}

import { z } from 'zod';
import { LooseArray } from '../../../util/schema-utils';
import { MaybeTimestamp } from '../../../util/timestamp';
import type { Release } from '../types';

export const ReleasesIndex = z
  .object({
    'releases-index': LooseArray(
      z
        .object({ 'releases.json': z.string() })
        .transform(({ 'releases.json': releasesUrl }) => releasesUrl),
    ).catch([]),
  })
  .transform(({ 'releases-index': releasesIndex }) => releasesIndex);

const ReleaseBase = z.object({
  'release-date': MaybeTimestamp,
  'release-notes': z.string(),
});
const ReleaseDetails = z.object({ version: z.string() });

export const DotnetSdkReleases = z
  .object({
    releases: LooseArray(
      ReleaseBase.extend({ sdks: z.array(ReleaseDetails) }),
    ).catch([]),
  })
  .transform(({ releases }): Release[] =>
    releases.flatMap(
      ({
        sdks,
        'release-date': releaseTimestamp,
        'release-notes': changelogUrl,
      }) =>
        sdks.map(({ version }) => ({
          version,
          releaseTimestamp,
          changelogUrl,
        })),
    ),
  );

export const DotnetRuntimeReleases = z
  .object({
    releases: LooseArray(ReleaseBase.extend({ runtime: ReleaseDetails })).catch(
      [],
    ),
  })
  .transform(({ releases }): Release[] =>
    releases.map(
      ({
        runtime: { version },
        'release-date': releaseTimestamp,
        'release-notes': changelogUrl,
      }) => ({ version, releaseTimestamp, changelogUrl }),
    ),
  );

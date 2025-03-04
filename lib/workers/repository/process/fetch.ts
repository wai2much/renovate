// TODO #22198
import is from '@sindresorhus/is';
import { getManagerConfig, mergeChildConfig } from '../../../config';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { getDefaultConfig } from '../../../modules/datasource';
import { getDefaultVersioning } from '../../../modules/datasource/common';
import type {
  PackageDependency,
  PackageFile,
} from '../../../modules/manager/types';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { clone } from '../../../util/clone';
import { applyPackageRules } from '../../../util/package-rules';
import * as p from '../../../util/promises';
import { Result } from '../../../util/result';
import { LookupStats } from '../../../util/stats';
import { PackageFiles } from '../package-files';
import { lookupUpdates } from './lookup';
import type { LookupUpdateConfig, UpdateResult } from './lookup/types';

type LookupResult = Result<PackageDependency, Error>;

async function lookup(
  packageFileConfig: RenovateConfig & PackageFile,
  indep: PackageDependency,
): Promise<LookupResult> {
  const dep = clone(indep);

  dep.updates = [];

  if (is.string(dep.depName)) {
    dep.depName = dep.depName.trim();
  }

  dep.packageName ??= dep.depName;

  if (dep.skipReason) {
    return Result.ok(dep);
  }

  if (!is.nonEmptyString(dep.packageName)) {
    dep.skipReason = 'invalid-name';
    return Result.ok(dep);
  }

  if (dep.isInternal && !packageFileConfig.updateInternalDeps) {
    dep.skipReason = 'internal-package';
    return Result.ok(dep);
  }

  const { depName } = dep;
  // TODO: fix types
  let depConfig = mergeChildConfig(packageFileConfig, dep);
  const datasourceDefaultConfig = await getDefaultConfig(depConfig.datasource!);
  depConfig = mergeChildConfig(depConfig, datasourceDefaultConfig);
  depConfig.versioning ??= getDefaultVersioning(depConfig.datasource);
  depConfig = await applyPackageRules(depConfig, 'pre-lookup');
  depConfig.packageName ??= depConfig.depName;

  if (depConfig.ignoreDeps!.includes(depName!)) {
    // TODO: fix types (#22198)
    logger.debug(`Dependency: ${depName!}, is ignored`);
    dep.skipReason = 'ignored';
    return Result.ok(dep);
  }

  if (depConfig.enabled === false) {
    logger.debug(`Dependency: ${depName!}, is disabled`);
    dep.skipReason = 'disabled';
    return Result.ok(dep);
  }

  if (!depConfig.datasource) {
    return Result.ok(dep);
  }

  return LookupStats.wrap(depConfig.datasource, async () => {
    return await Result.wrap(lookupUpdates(depConfig as LookupUpdateConfig))
      .onValue((dep) => {
        logger.trace({ dep }, 'Dependency lookup success');
      })
      .onError((err) => {
        logger.trace({ err, depName }, 'Dependency lookup error');
      })
      .catch((err): Result<UpdateResult, Error> => {
        if (
          packageFileConfig.repoIsOnboarded === true ||
          !(err instanceof ExternalHostError)
        ) {
          return Result.err(err);
        }

        const cause = err.err;
        return Result.ok({
          updates: [],
          warnings: [
            { topic: 'Lookup Error', message: `${depName}: ${cause.message}` },
          ],
        });
      })
      .transform((upd): PackageDependency => Object.assign(dep, upd));
  });
}

async function fetchManagerPackagerFileUpdates(
  config: RenovateConfig,
  managerConfig: RenovateConfig,
  pFile: PackageFile,
): Promise<void> {
  const { packageFile } = pFile;
  const packageFileConfig = mergeChildConfig(managerConfig, pFile);
  if (pFile.extractedConstraints) {
    packageFileConfig.constraints = {
      ...pFile.extractedConstraints,
      ...config.constraints,
    };
  }
  const { manager } = packageFileConfig;
  const queue = pFile.deps.map(
    (dep) => async (): Promise<PackageDependency> => {
      const updates = await lookup(packageFileConfig, dep);
      return updates.unwrapOrThrow();
    },
  );
  logger.trace(
    { manager, packageFile, queueLength: queue.length },
    'fetchManagerPackagerFileUpdates starting with concurrency',
  );

  pFile.deps = await p.all(queue);
  logger.trace({ packageFile }, 'fetchManagerPackagerFileUpdates finished');
}

async function fetchManagerUpdates(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]>,
  manager: string,
): Promise<void> {
  const managerConfig = getManagerConfig(config, manager);
  const queue = packageFiles[manager].map(
    (pFile) => (): Promise<void> =>
      fetchManagerPackagerFileUpdates(config, managerConfig, pFile),
  );
  logger.trace(
    { manager, queueLength: queue.length },
    'fetchManagerUpdates starting',
  );
  await p.all(queue);
  logger.trace({ manager }, 'fetchManagerUpdates finished');
}

export async function fetchUpdates(
  config: RenovateConfig,
  packageFiles: Record<string, PackageFile[]>,
): Promise<void> {
  const managers = Object.keys(packageFiles);
  const allManagerJobs = managers.map((manager) =>
    fetchManagerUpdates(config, packageFiles, manager),
  );
  await Promise.all(allManagerJobs);
  PackageFiles.add(config.baseBranch!, { ...packageFiles });
  logger.debug(
    { baseBranch: config.baseBranch },
    'Package releases lookups complete',
  );
}

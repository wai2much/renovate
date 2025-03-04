import * as massage from './massage';
import type { RenovateConfig } from './types';

describe('config/massage', () => {
  describe('massageConfig', () => {
    it('returns empty', () => {
      const config: RenovateConfig = {};
      const res = massage.massageConfig(config);
      expect(res).toEqual({});
    });

    it('massages strings to array', () => {
      const config: RenovateConfig = { schedule: 'before 5am' as never };
      const res = massage.massageConfig(config);
      expect(Array.isArray(res.schedule)).toBeTrue();
    });

    it('massages packageRules matchUpdateTypes', () => {
      const config: RenovateConfig = {
        packageRules: [
          {
            matchPackageNames: ['foo'],
            separateMajorMinor: false,
            minor: { semanticCommitType: 'feat' },
            patch: { semanticCommitType: 'fix' },
          },
        ],
      };
      const res = massage.massageConfig(config);
      expect(res).toEqual({
        packageRules: [
          { matchPackageNames: ['foo'], separateMajorMinor: false },
          {
            matchPackageNames: ['foo'],
            matchUpdateTypes: ['minor'],
            semanticCommitType: 'feat',
          },
          {
            matchPackageNames: ['foo'],
            matchUpdateTypes: ['patch'],
            semanticCommitType: 'fix',
          },
        ],
      });
      expect(res.packageRules).toHaveLength(3);
    });

    it('filters packageRules with only match/exclude', () => {
      const config: RenovateConfig = {
        packageRules: [
          { matchBaseBranches: ['main'], major: { enabled: true } },
        ],
      };
      const res = massage.massageConfig(config);
      expect(res.packageRules).toHaveLength(1);
    });

    it('does not massage lockFileMaintenance', () => {
      const config: RenovateConfig = {
        packageRules: [
          {
            matchManagers: ['helmv3'],
            matchBaseBranches: ['release/ft10/1.9.x'],
            lockFileMaintenance: { enabled: true },
            schedule: ['at any time'],
          },
        ],
      };
      const res = massage.massageConfig(config);
      expect(res).toEqual({
        packageRules: [
          {
            lockFileMaintenance: { enabled: true },
            matchBaseBranches: ['release/ft10/1.9.x'],
            matchManagers: ['helmv3'],
            schedule: ['at any time'],
          },
        ],
      });
      expect(res.packageRules).toHaveLength(1);
    });
  });
});

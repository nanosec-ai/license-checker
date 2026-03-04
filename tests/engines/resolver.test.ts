import { describe, it, expect } from 'vitest';
import { runResolver } from '../../src/engines/resolver.js';
import type { ScanContext } from '../../src/types/index.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('resolver engine', () => {
  it('resolves npm dependencies from package.json', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'resolver-test-'));
    try {
      const ctx: ScanContext = {
        workDir,
        ecosystem: 'npm',
        manifest_content: JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          dependencies: {
            'is-odd': '3.0.1',
          },
        }),
        project_name: 'test-project',
        project_version: '1.0.0',
        project_license: 'MIT',
        distribution_model: 'unknown',
        include_dev: false,
      };

      const result = await runResolver(ctx);

      expect(result.engine).toBe('resolver');
      expect(result.error).toBeUndefined();
      expect(result.resolved_deps).toBeDefined();
      expect(result.resolved_deps!.length).toBeGreaterThan(0);

      const isOdd = result.resolved_deps!.find(d => d.name === 'is-odd');
      expect(isOdd).toBeDefined();
      expect(isOdd!.version).toBe('3.0.1');
      expect(isOdd!.purl).toBe('pkg:npm/is-odd@3.0.1');
      expect(isOdd!.is_direct).toBe(true);

      expect(result.dep_counts).toBeDefined();
      expect(result.dep_counts!.total).toBeGreaterThan(0);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }, 60_000);

  it('returns error for invalid manifest', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'resolver-test-'));
    try {
      const ctx: ScanContext = {
        workDir,
        ecosystem: 'npm',
        manifest_content: 'not-json',
        project_name: 'test',
        project_version: null,
        project_license: 'MIT',
        distribution_model: 'unknown',
        include_dev: false,
      };

      const result = await runResolver(ctx);
      expect(result.error).toBeDefined();
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  });

  it('resolves zero-dependency project', async () => {
    const workDir = await mkdtemp(join(tmpdir(), 'resolver-test-'));
    try {
      const ctx: ScanContext = {
        workDir,
        ecosystem: 'npm',
        manifest_content: JSON.stringify({
          name: 'empty-project',
          version: '1.0.0',
        }),
        project_name: 'empty-project',
        project_version: '1.0.0',
        project_license: 'MIT',
        distribution_model: 'unknown',
        include_dev: false,
      };

      const result = await runResolver(ctx);
      expect(result.error).toBeUndefined();
      expect(result.resolved_deps).toEqual([]);
      expect(result.dep_counts!.total).toBe(0);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }, 60_000);
});

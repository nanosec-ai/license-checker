import { describe, it, expect } from 'vitest';
import { handleCheckCompat } from '../../src/tools/check-compat.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

describe('check_compatibility integration', () => {
  it('reports no conflicts for zero-dep project', async () => {
    const pkg = await readFile(join(FIXTURES, 'zero-deps', 'package.json'), 'utf-8');

    const result = await handleCheckCompat({
      package_json: pkg,
      project_license: 'MIT',
    });

    expect(result.compatible).toBe(true);
    expect(result.conflicts).toEqual([]);
  }, 60_000);

  it('reports compatible for clean MIT project', async () => {
    const pkg = await readFile(join(FIXTURES, 'clean-mit-project', 'package.json'), 'utf-8');

    const result = await handleCheckCompat({
      package_json: pkg,
      project_license: 'MIT',
      distribution_model: 'binary',
    });

    // Real npm deps (lodash/express/debug) are all permissive
    // May have UNKNOWN licenses for some deps that npm doesn't include license in lockfile
    const criticals = result.conflicts.filter(c => c.severity === 'CRITICAL');
    // No GPL/AGPL contamination expected
    const copyleft = criticals.filter(c =>
      c.conflict_type === 'COPYLEFT_IN_PROPRIETARY' ||
      c.conflict_type === 'AGPL_NETWORK',
    );
    expect(copyleft).toEqual([]);
  }, 120_000);
});

describe('check_compatibility with dependency_licenses', () => {
  it('detects AGPL in SaaS as CRITICAL', async () => {
    const result = await handleCheckCompat({
      project_license: 'MIT',
      dependency_licenses: ['AGPL-3.0-only'],
      distribution: 'saas',
    });

    expect(result.compatible).toBe(false);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].severity).toBe('CRITICAL');
    expect(result.conflicts[0].conflict_type).toBe('AGPL_NETWORK');
  });

  it('detects Apache-2.0 + GPL-2.0 patent conflict', async () => {
    const result = await handleCheckCompat({
      project_license: 'Apache-2.0',
      dependency_licenses: ['GPL-2.0-only'],
      distribution: 'binary',
    });

    expect(result.compatible).toBe(false);
    const patent = result.conflicts.find(c => c.conflict_type === 'PATENT_CLAUSE');
    expect(patent).toBeDefined();
    expect(patent!.severity).toBe('HIGH');
  });

  it('reports all compatible for permissive licenses', async () => {
    const result = await handleCheckCompat({
      project_license: 'MIT',
      dependency_licenses: ['MIT', 'Apache-2.0', 'ISC', 'BSD-3-Clause'],
      distribution: 'binary',
    });

    expect(result.compatible).toBe(true);
    expect(result.conflicts).toEqual([]);
  });

  it('handles bulk incompatibilities without crashing', async () => {
    const result = await handleCheckCompat({
      project_license: 'MIT',
      dependency_licenses: [
        'AGPL-3.0-only', 'AGPL-3.0-only', 'AGPL-3.0-only',
        'GPL-3.0-only', 'GPL-3.0-only', 'GPL-3.0-only',
        'GPL-2.0-only', 'GPL-2.0-only',
      ],
      distribution: 'binary',
    });

    expect(result.compatible).toBe(false);
    expect(result.conflicts).toHaveLength(8);
  });

  it('accepts distribution_model as alias for distribution', async () => {
    const result = await handleCheckCompat({
      project_license: 'MIT',
      dependency_licenses: ['AGPL-3.0-only'],
      distribution_model: 'saas',
    });

    expect(result.compatible).toBe(false);
    expect(result.conflicts[0].conflict_type).toBe('AGPL_NETWORK');
  });
});

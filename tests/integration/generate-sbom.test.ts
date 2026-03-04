import { describe, it, expect } from 'vitest';
import { handleGenerateSbom } from '../../src/tools/generate-sbom.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

describe('generate_sbom integration', () => {
  it('generates valid CycloneDX for zero-dep project', async () => {
    const pkg = await readFile(join(FIXTURES, 'zero-deps', 'package.json'), 'utf-8');

    const sbom = await handleGenerateSbom({
      package_json: pkg,
      format: 'cyclonedx',
    });

    expect(sbom.format).toBe('cyclonedx');
    expect(sbom.content.bomFormat).toBe('CycloneDX');
    expect(sbom.content.specVersion).toBe('1.5');
    expect(sbom.validation.valid).toBe(true);

    const components = sbom.content.components as unknown[];
    expect(components).toEqual([]);
  }, 60_000);

  it('generates CycloneDX with correct components for real project', async () => {
    const pkg = await readFile(join(FIXTURES, 'clean-mit-project', 'package.json'), 'utf-8');

    const sbom = await handleGenerateSbom({
      package_json: pkg,
      format: 'cyclonedx',
      include_dev: false,
    });

    expect(sbom.format).toBe('cyclonedx');
    expect(sbom.validation.valid).toBe(true);

    const components = sbom.content.components as Record<string, unknown>[];
    expect(components.length).toBeGreaterThan(0);

    // Every component should have purl
    for (const c of components) {
      expect(c.purl).toBeDefined();
      expect(c.name).toBeDefined();
      expect(c.version).toBeDefined();
    }
  }, 120_000);

  it('generates valid SPDX for zero-dep project', async () => {
    const pkg = await readFile(join(FIXTURES, 'zero-deps', 'package.json'), 'utf-8');

    const sbom = await handleGenerateSbom({
      package_json: pkg,
      format: 'spdx',
    });

    expect(sbom.format).toBe('spdx');
    expect(sbom.content.spdxVersion).toBe('SPDX-2.3');
    expect(sbom.validation.valid).toBe(true);
  }, 60_000);

  it('generates SPDX with relationships for real project', async () => {
    const pkg = await readFile(join(FIXTURES, 'clean-mit-project', 'package.json'), 'utf-8');

    const sbom = await handleGenerateSbom({
      package_json: pkg,
      format: 'spdx',
      include_dev: false,
    });

    expect(sbom.format).toBe('spdx');
    expect(sbom.validation.valid).toBe(true);

    const packages = sbom.content.packages as Record<string, unknown>[];
    expect(packages.length).toBeGreaterThan(1); // at least root + deps

    const relationships = sbom.content.relationships as Record<string, unknown>[];
    const describes = relationships.find((r: Record<string, unknown>) => r.relationshipType === 'DESCRIBES');
    expect(describes).toBeDefined();
  }, 120_000);
});

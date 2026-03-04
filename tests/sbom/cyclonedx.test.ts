import { describe, it, expect } from 'vitest';
import { generateCycloneDx } from '../../src/sbom/cyclonedx.js';
import { validateCycloneDx } from '../../src/sbom/validator.js';
import type { ResolvedDep } from '../../src/types/index.js';

function makeDeps(count: number): ResolvedDep[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `pkg-${i}`,
    version: `${i}.0.0`,
    license_declared: 'MIT',
    license_file_content: null,
    purl: `pkg:npm/pkg-${i}@${i}.0.0`,
    scope: 'required' as const,
    integrity: `sha512-${Buffer.from(`hash${i}`).toString('base64')}`,
    is_direct: i < 5,
    introduced_by: [`pkg-${i}`],
    dependencies: i < count - 1 ? [`pkg-${i + 1}`] : [],
  }));
}

describe('CycloneDX SBOM generation', () => {
  it('generates valid CycloneDX 1.5 JSON', () => {
    const deps = makeDeps(10);
    const sbom = generateCycloneDx({
      project_name: 'test-project',
      project_version: '1.0.0',
      deps,
      licenseMap: { 'MIT': 10 },
    });

    expect(sbom.bomFormat).toBe('CycloneDX');
    expect(sbom.specVersion).toBe('1.5');
    expect(sbom.serialNumber).toMatch(/^urn:uuid:/);
    expect(sbom.version).toBe(1);

    const metadata = sbom.metadata as Record<string, unknown>;
    expect(metadata.timestamp).toBeDefined();
    expect(metadata.tools).toBeDefined();

    const components = sbom.components as Record<string, unknown>[];
    expect(components).toHaveLength(10);

    // Each component has name, version, purl, licenses
    for (const c of components) {
      expect(c.name).toBeDefined();
      expect(c.version).toBeDefined();
      expect(c.purl).toBeDefined();
      expect(c.licenses).toBeDefined();
    }
  });

  it('passes validation', () => {
    const deps = makeDeps(5);
    const sbom = generateCycloneDx({
      project_name: 'test-project',
      project_version: '1.0.0',
      deps,
      licenseMap: { 'MIT': 5 },
    });

    const validation = validateCycloneDx(sbom);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it('includes correct purl format', () => {
    const deps: ResolvedDep[] = [{
      name: '@scope/pkg',
      version: '1.0.0',
      license_declared: 'MIT',
      license_file_content: null,
      purl: 'pkg:npm/@scope/pkg@1.0.0',
      scope: 'required',
      integrity: null,
      is_direct: true,
      introduced_by: ['@scope/pkg'],
      dependencies: [],
    }];

    const sbom = generateCycloneDx({
      project_name: 'test',
      project_version: '1.0.0',
      deps,
      licenseMap: { 'MIT': 1 },
    });

    const components = sbom.components as Record<string, unknown>[];
    expect(components[0].purl).toBe('pkg:npm/@scope/pkg@1.0.0');
  });

  it('handles empty deps', () => {
    const sbom = generateCycloneDx({
      project_name: 'empty',
      project_version: '1.0.0',
      deps: [],
      licenseMap: {},
    });

    const components = sbom.components as Record<string, unknown>[];
    expect(components).toEqual([]);
  });
});

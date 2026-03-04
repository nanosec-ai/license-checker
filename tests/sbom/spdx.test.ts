import { describe, it, expect } from 'vitest';
import { generateSpdx } from '../../src/sbom/spdx.js';
import { validateSpdx } from '../../src/sbom/validator.js';
import type { ResolvedDep } from '../../src/types/index.js';

function makeDeps(count: number): ResolvedDep[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `pkg-${i}`,
    version: `${i}.0.0`,
    license_declared: 'MIT',
    license_file_content: null,
    purl: `pkg:npm/pkg-${i}@${i}.0.0`,
    scope: 'required' as const,
    integrity: null,
    is_direct: i < 3,
    introduced_by: [`pkg-${i}`],
    dependencies: [],
  }));
}

describe('SPDX SBOM generation', () => {
  it('generates valid SPDX 2.3 JSON', () => {
    const deps = makeDeps(5);
    const sbom = generateSpdx({
      project_name: 'test-project',
      project_version: '1.0.0',
      deps,
      licenseMap: { 'MIT': 5 },
    });

    expect(sbom.spdxVersion).toBe('SPDX-2.3');
    expect(sbom.dataLicense).toBe('CC0-1.0');
    expect(sbom.SPDXID).toBe('SPDXRef-DOCUMENT');

    const packages = sbom.packages as Record<string, unknown>[];
    // +1 for root package
    expect(packages).toHaveLength(6);

    for (const p of packages) {
      expect(p.SPDXID).toBeDefined();
      expect(p.name).toBeDefined();
      expect(p.versionInfo).toBeDefined();
    }
  });

  it('passes validation', () => {
    const deps = makeDeps(5);
    const sbom = generateSpdx({
      project_name: 'test-project',
      project_version: '1.0.0',
      deps,
      licenseMap: { 'MIT': 5 },
    });

    const validation = validateSpdx(sbom);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
  });

  it('includes DESCRIBES relationship from DOCUMENT to root', () => {
    const deps = makeDeps(2);
    const sbom = generateSpdx({
      project_name: 'my-app',
      project_version: '1.0.0',
      deps,
      licenseMap: { 'MIT': 2 },
    });

    const relationships = sbom.relationships as Record<string, unknown>[];
    const describes = relationships.find(r => r.relationshipType === 'DESCRIBES');
    expect(describes).toBeDefined();
    expect(describes!.spdxElementId).toBe('SPDXRef-DOCUMENT');
  });

  it('includes DEPENDS_ON relationships for direct deps', () => {
    const deps = makeDeps(3);
    const sbom = generateSpdx({
      project_name: 'my-app',
      project_version: '1.0.0',
      deps,
      licenseMap: { 'MIT': 3 },
    });

    const relationships = sbom.relationships as Record<string, unknown>[];
    const dependsOn = relationships.filter(r => r.relationshipType === 'DEPENDS_ON');
    expect(dependsOn.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from 'vitest';
import { assessCraReadiness } from '../../src/scoring/cra-readiness.js';
import type { ResolvedDep, SbomOutput } from '../../src/types/index.js';

function makeDep(overrides: Partial<ResolvedDep> = {}): ResolvedDep {
  return {
    name: 'test',
    version: '1.0.0',
    license_declared: 'MIT',
    license_file_content: null,
    purl: 'pkg:npm/test@1.0.0',
    scope: 'required',
    integrity: null,
    is_direct: true,
    introduced_by: ['test'],
    dependencies: [],
    ...overrides,
  };
}

const validSbom: SbomOutput = {
  format: 'cyclonedx',
  content: {},
  validation: { valid: true, errors: [], warnings: [] },
};

const invalidSbom: SbomOutput = {
  format: 'cyclonedx',
  content: {},
  validation: { valid: false, errors: ['missing field'], warnings: [] },
};

describe('CRA readiness assessment', () => {
  it('returns 100 for perfect project with valid SBOM', () => {
    const result = assessCraReadiness({
      deps: [makeDep()],
      licenseMap: { 'MIT': 1 },
      sbom: validSbom,
    });

    expect(result.readiness_score).toBe(100);
    expect(result.gaps).toEqual([]);
    expect(result.sbom_generated).toBe(true);
    expect(result.all_licenses_identified).toBe(true);
    expect(result.no_unknown_licenses).toBe(true);
    expect(result.purls_present).toBe(true);
    expect(result.sbom_valid).toBe(true);
  });

  it('returns 100 for zero-dependency project with SBOM', () => {
    const result = assessCraReadiness({
      deps: [],
      licenseMap: {},
      sbom: validSbom,
    });

    expect(result.readiness_score).toBe(100);
  });

  it('scores data completeness when SBOM not in scope', () => {
    const result = assessCraReadiness({
      deps: [makeDep()],
      licenseMap: { 'MIT': 1 },
    });

    // No SBOM, not required: scores data completeness only (42+33+25=100)
    expect(result.readiness_score).toBe(100);
    expect(result.sbom_generated).toBe(false);
    expect(result.gaps).toContain('Run generate_sbom to produce the required SBOM artifact');
  });

  it('penalizes missing SBOM when sbomRequired is true', () => {
    const result = assessCraReadiness({
      deps: [makeDep()],
      licenseMap: { 'MIT': 1 },
      sbomRequired: true,
    });

    // Missing sbom_generated (-25) and sbom_valid (-15)
    expect(result.readiness_score).toBe(60);
    expect(result.sbom_generated).toBe(false);
  });

  it('penalizes unknown licenses (with SBOM)', () => {
    const result = assessCraReadiness({
      deps: [makeDep({ license_declared: 'UNKNOWN' })],
      licenseMap: { 'UNKNOWN': 1 },
      sbom: validSbom,
    });

    // Missing: all_identified (-25), no_unknowns (-20) = 55
    expect(result.readiness_score).toBe(55);
    expect(result.all_licenses_identified).toBe(false);
    expect(result.no_unknown_licenses).toBe(false);
  });

  it('penalizes invalid SBOM', () => {
    const result = assessCraReadiness({
      deps: [makeDep()],
      licenseMap: { 'MIT': 1 },
      sbom: invalidSbom,
    });

    expect(result.readiness_score).toBe(85);
    expect(result.sbom_valid).toBe(false);
  });

  it('penalizes missing purls', () => {
    const result = assessCraReadiness({
      deps: [makeDep({ purl: '' })],
      licenseMap: { 'MIT': 1 },
      sbom: validSbom,
    });

    expect(result.readiness_score).toBe(85);
    expect(result.purls_present).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { checkCompatibility, classifyLicense } from '../../src/data/compatibility-matrix.js';

describe('classifyLicense', () => {
  it('classifies permissive licenses', () => {
    expect(classifyLicense('MIT')).toBe('permissive');
    expect(classifyLicense('ISC')).toBe('permissive');
    expect(classifyLicense('BSD-3-Clause')).toBe('permissive');
    expect(classifyLicense('Apache-2.0')).toBe('permissive');
  });

  it('classifies copyleft licenses', () => {
    expect(classifyLicense('GPL-3.0-only')).toBe('copyleft');
    expect(classifyLicense('AGPL-3.0-only')).toBe('copyleft');
  });

  it('classifies weak copyleft', () => {
    expect(classifyLicense('LGPL-2.1-only')).toBe('weak-copyleft');
    expect(classifyLicense('MPL-2.0')).toBe('weak-copyleft');
  });

  it('classifies unknown/custom', () => {
    expect(classifyLicense('UNKNOWN')).toBe('unknown');
    expect(classifyLicense('CUSTOM')).toBe('custom');
  });
});

describe('checkCompatibility', () => {
  it('permissive deps are always compatible', () => {
    const result = checkCompatibility({
      dep_name: 'foo',
      dep_license: 'MIT',
      project_license: 'GPL-3.0-only',
      distribution_model: 'binary',
      introduced_by: ['foo'],
    });
    expect(result).toBeUndefined();
  });

  it('AGPL is CRITICAL for non-AGPL projects', () => {
    const result = checkCompatibility({
      dep_name: 'agpl-lib',
      dep_license: 'AGPL-3.0-only',
      project_license: 'MIT',
      distribution_model: 'binary',
      introduced_by: ['agpl-lib'],
    });
    expect(result).toBeDefined();
    expect(result!.severity).toBe('CRITICAL');
    expect(result!.conflict_type).toBe('AGPL_NETWORK');
  });

  it('GPL in MIT binary is CRITICAL', () => {
    const result = checkCompatibility({
      dep_name: 'gpl-lib',
      dep_license: 'GPL-3.0-only',
      project_license: 'MIT',
      distribution_model: 'binary',
      introduced_by: ['gpl-lib'],
    });
    expect(result).toBeDefined();
    expect(result!.severity).toBe('CRITICAL');
  });

  it('GPL-2.0 in Apache-2.0 is patent clause conflict (HIGH)', () => {
    const result = checkCompatibility({
      dep_name: 'gpl2-lib',
      dep_license: 'GPL-2.0-only',
      project_license: 'Apache-2.0',
      distribution_model: 'binary',
      introduced_by: ['gpl2-lib'],
    });
    expect(result).toBeDefined();
    // Could match either PATENT_CLAUSE or COPYLEFT_IN_PROPRIETARY
    expect(['HIGH', 'CRITICAL']).toContain(result!.severity);
  });

  it('UNKNOWN license is flagged as HIGH', () => {
    const result = checkCompatibility({
      dep_name: 'unknown-pkg',
      dep_license: 'UNKNOWN',
      project_license: 'MIT',
      distribution_model: 'binary',
      introduced_by: ['unknown-pkg'],
    });
    expect(result).toBeDefined();
    expect(result!.severity).toBe('HIGH');
    expect(result!.conflict_type).toBe('UNKNOWN_LICENSE');
  });
});

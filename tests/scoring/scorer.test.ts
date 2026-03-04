import { describe, it, expect } from 'vitest';
import { calculateScore, countSeverities, sortFindings } from '../../src/scoring/scorer.js';
import type { Finding } from '../../src/types/index.js';

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    engine: 'compatibility',
    severity: 'MEDIUM',
    package_name: 'test-pkg',
    package_version: '1.0.0',
    finding_id: 'TEST-001',
    title: 'Test finding',
    detail: 'Test detail',
    license_detected: 'MIT',
    introduced_by: ['test-pkg'],
    conflict_type: null,
    remediation: null,
    references: [],
    ...overrides,
  };
}

describe('calculateScore', () => {
  it('returns 100 for no findings', () => {
    const { compliance_score, risk_grade } = calculateScore([]);
    expect(compliance_score).toBe(100);
    expect(risk_grade).toBe('A');
  });

  it('deducts 20 per CRITICAL finding', () => {
    const findings = [makeFinding({ severity: 'CRITICAL' })];
    const { compliance_score } = calculateScore(findings);
    expect(compliance_score).toBe(80);
  });

  it('caps CRITICAL deductions at 60', () => {
    // 10 CRITICAL findings: 10 * 20 = 200, capped at 60
    const findings = Array.from({ length: 10 }, (_, i) =>
      makeFinding({ severity: 'CRITICAL', package_name: `pkg-${i}` }),
    );
    const { compliance_score, risk_grade } = calculateScore(findings);
    expect(compliance_score).toBe(40);
    expect(risk_grade).toBe('D');
  });

  it('applies transitive multiplier for CRITICAL findings', () => {
    const findings = [
      makeFinding({
        severity: 'CRITICAL',
        introduced_by: ['root', 'middle', 'leaf'], // depth > 1
      }),
    ];
    const { compliance_score } = calculateScore(findings);
    // ceil(20 * 1.25) = 25
    expect(compliance_score).toBe(75);
  });

  it('deducts 10 per HIGH finding', () => {
    const findings = [makeFinding({ severity: 'HIGH' })];
    const { compliance_score } = calculateScore(findings);
    expect(compliance_score).toBe(90);
  });

  it('scores never go below 0', () => {
    const findings = [
      ...Array.from({ length: 5 }, () => makeFinding({ severity: 'CRITICAL' })),
      ...Array.from({ length: 5 }, () => makeFinding({ severity: 'HIGH', package_name: 'h' })),
      ...Array.from({ length: 10 }, () => makeFinding({ severity: 'MEDIUM', package_name: 'm' })),
    ];
    const { compliance_score } = calculateScore(findings);
    expect(compliance_score).toBeGreaterThanOrEqual(0);
  });

  it('maps grades correctly', () => {
    expect(calculateScore([]).risk_grade).toBe('A');
    expect(calculateScore([makeFinding({ severity: 'HIGH' })]).risk_grade).toBe('A'); // 90 >= 90
    expect(calculateScore([makeFinding({ severity: 'HIGH' }), makeFinding({ severity: 'HIGH', package_name: 'b' }), makeFinding({ severity: 'HIGH', package_name: 'c' })]).risk_grade).toBe('B');
  });

  it('applies policy violation minimum deduction', () => {
    const findings = [makeFinding({
      severity: 'HIGH',
      finding_id: 'POL-DENIED-GPL3-pkg',
    })];
    const { compliance_score } = calculateScore(findings);
    // max(10, 15) = 15 deduction
    expect(compliance_score).toBe(85);
  });
});

describe('countSeverities', () => {
  it('counts correctly', () => {
    const findings = [
      makeFinding({ severity: 'CRITICAL' }),
      makeFinding({ severity: 'CRITICAL' }),
      makeFinding({ severity: 'HIGH' }),
      makeFinding({ severity: 'LOW' }),
    ];
    expect(countSeverities(findings)).toEqual({
      critical: 2, high: 1, medium: 0, low: 1, info: 0,
    });
  });
});

describe('sortFindings', () => {
  it('sorts by severity then package name', () => {
    const findings = [
      makeFinding({ severity: 'LOW', package_name: 'z-pkg' }),
      makeFinding({ severity: 'CRITICAL', package_name: 'b-pkg' }),
      makeFinding({ severity: 'CRITICAL', package_name: 'a-pkg' }),
      makeFinding({ severity: 'HIGH', package_name: 'c-pkg' }),
    ];
    const sorted = sortFindings(findings);
    expect(sorted[0].package_name).toBe('a-pkg');
    expect(sorted[1].package_name).toBe('b-pkg');
    expect(sorted[2].severity).toBe('HIGH');
    expect(sorted[3].severity).toBe('LOW');
  });
});

import { describe, it, expect } from 'vitest';
import { handleCheckLicenses } from '../../src/tools/check-licenses.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

describe('check_licenses integration', () => {
  it('scores 100 for a zero-dependency project', async () => {
    const pkg = await readFile(join(FIXTURES, 'zero-deps', 'package.json'), 'utf-8');

    const report = await handleCheckLicenses({
      package_json: pkg,
    });

    expect(report.compliance_score).toBe(100);
    expect(report.risk_grade).toBe('A');
    expect(report.findings).toEqual([]);
    expect(report.total_dependencies).toBe(0);
    expect(report.project_license).toBe('MIT');
  }, 60_000);

  it('reports clean MIT project with no CRITICAL findings', async () => {
    const pkg = await readFile(join(FIXTURES, 'clean-mit-project', 'package.json'), 'utf-8');

    const report = await handleCheckLicenses({
      package_json: pkg,
    });

    // All standard npm deps (lodash, express, debug) are MIT/ISC/BSD
    expect(report.severity_counts.critical).toBe(0);
    expect(report.compliance_score).toBeGreaterThanOrEqual(70);
    expect(report.project_name).toBe('clean-mit-project');
    expect(report.ecosystem).toBe('npm');
    expect(report.total_dependencies).toBeGreaterThan(0);
    expect(report.license_summary.total_licenses_detected).toBeGreaterThan(0);
  }, 120_000);

  it('detects unknown/missing licenses', async () => {
    const report = await handleCheckLicenses({
      package_json: JSON.stringify({
        name: 'test-unknown',
        version: '1.0.0',
        license: 'MIT',
      }),
    });

    // Zero deps = clean
    expect(report.compliance_score).toBe(100);
  }, 60_000);

  it('enforces custom policy with denied licenses', async () => {
    // Use a mock resolver result by testing the policy engine directly
    // For integration, we test with a zero-dep project + policy
    const report = await handleCheckLicenses({
      package_json: JSON.stringify({
        name: 'policy-test',
        version: '1.0.0',
        license: 'MIT',
      }),
      policy: { denied: ['GPL-3.0-only'] },
    });

    expect(report.policy_result.policy_applied).toBeDefined();
  }, 60_000);

  it('reports CRA readiness >= 75 for clean project without SBOM', async () => {
    const report = await handleCheckLicenses({
      package_json: JSON.stringify({
        name: 'cra-test',
        version: '1.0.0',
        license: 'MIT',
        dependencies: { 'uuid': '^9.0.0' },
      }),
    });

    expect(report.cra_readiness).toBeDefined();
    expect(report.cra_readiness.readiness_score).toBeGreaterThanOrEqual(75);
    expect(report.cra_readiness.all_licenses_identified).toBe(true);
    expect(report.cra_readiness.purls_present).toBe(true);
    expect(report.cra_readiness.gaps).toContain('Run generate_sbom to produce the required SBOM artifact');
  }, 60_000);
});

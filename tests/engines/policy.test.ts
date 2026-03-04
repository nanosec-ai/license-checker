import { describe, it, expect } from 'vitest';
import { runPolicy } from '../../src/engines/policy.js';
import type { EngineResult, ScanContext } from '../../src/types/index.js';

function makeCtx(overrides: Partial<ScanContext> = {}): ScanContext {
  return {
    workDir: '/tmp/test',
    ecosystem: 'npm',
    manifest_content: '{}',
    project_name: 'test',
    project_version: '1.0.0',
    project_license: 'MIT',
    distribution_model: 'binary',
    include_dev: false,
    ...overrides,
  };
}

function makeIdentifierResult(deps: Array<{ name: string; license: string }>): EngineResult {
  return {
    engine: 'identifier',
    findings: [],
    duration_ms: 0,
    resolved_deps: deps.map(d => ({
      name: d.name,
      version: '1.0.0',
      license_declared: d.license,
      license_file_content: null,
      purl: `pkg:npm/${d.name}@1.0.0`,
      scope: 'required' as const,
      integrity: null,
      is_direct: true,
      introduced_by: [d.name],
      dependencies: [],
    })),
  };
}

describe('policy engine', () => {
  it('flags denied licenses', async () => {
    const ctx = makeCtx({ policy: { denied: ['GPL-3.0-only'] } });
    const ident = makeIdentifierResult([
      { name: 'gpl-pkg', license: 'GPL-3.0-only' },
      { name: 'mit-pkg', license: 'MIT' },
    ]);

    const result = await runPolicy(ctx, ident);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].finding_id).toContain('POL-DENIED');
    expect(result.findings[0].package_name).toBe('gpl-pkg');
  });

  it('uses default deny list when no policy provided', async () => {
    const ctx = makeCtx();
    const ident = makeIdentifierResult([
      { name: 'agpl-pkg', license: 'AGPL-3.0-only' },
      { name: 'mit-pkg', license: 'MIT' },
    ]);

    const result = await runPolicy(ctx, ident);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].package_name).toBe('agpl-pkg');
  });

  it('flags not-allowed licenses when allowlist is set', async () => {
    const ctx = makeCtx({ policy: { allowed: ['MIT', 'ISC', 'BSD-3-Clause'] } });
    const ident = makeIdentifierResult([
      { name: 'mit-pkg', license: 'MIT' },
      { name: 'apache-pkg', license: 'Apache-2.0' },
    ]);

    const result = await runPolicy(ctx, ident);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].finding_id).toContain('POL-NOT-ALLOWED');
    expect(result.findings[0].package_name).toBe('apache-pkg');
  });

  it('allowed overrides denied for same license', async () => {
    const ctx = makeCtx({
      policy: {
        allowed: ['MIT', 'GPL-3.0-only'],
        denied: ['GPL-3.0-only'],
      },
    });
    const ident = makeIdentifierResult([
      { name: 'gpl-pkg', license: 'GPL-3.0-only' },
    ]);

    const result = await runPolicy(ctx, ident);
    // No denied findings because allowed overrides denied
    const denied = result.findings.filter(f => f.finding_id.includes('POL-DENIED'));
    expect(denied).toHaveLength(0);
  });

  it('skips UNKNOWN licenses', async () => {
    const ctx = makeCtx({ policy: { denied: ['UNKNOWN'] } });
    const ident = makeIdentifierResult([
      { name: 'unknown-pkg', license: 'UNKNOWN' },
    ]);

    const result = await runPolicy(ctx, ident);
    expect(result.findings).toEqual([]);
  });
});

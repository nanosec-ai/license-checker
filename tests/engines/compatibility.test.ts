import { describe, it, expect } from 'vitest';
import { runCompatibility } from '../../src/engines/compatibility.js';
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

function makeIdentifierResult(deps: Array<{
  name: string;
  license: string;
  is_direct?: boolean;
  introduced_by?: string[];
}>): EngineResult {
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
      is_direct: d.is_direct ?? true,
      introduced_by: d.introduced_by ?? [d.name],
      dependencies: [],
    })),
  };
}

describe('compatibility engine', () => {
  it('passes for all-permissive deps', async () => {
    const ctx = makeCtx();
    const ident = makeIdentifierResult([
      { name: 'a', license: 'MIT' },
      { name: 'b', license: 'ISC' },
      { name: 'c', license: 'BSD-3-Clause' },
    ]);

    const result = await runCompatibility(ctx, ident);
    expect(result.findings).toEqual([]);
  });

  it('detects AGPL in non-AGPL project as CRITICAL', async () => {
    const ctx = makeCtx({ project_license: 'MIT' });
    const ident = makeIdentifierResult([
      { name: 'agpl-lib', license: 'AGPL-3.0-only' },
    ]);

    const result = await runCompatibility(ctx, ident);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('CRITICAL');
    expect(result.findings[0].conflict_type).toBe('AGPL_NETWORK');
  });

  it('detects GPL in MIT binary project as CRITICAL', async () => {
    const ctx = makeCtx({ project_license: 'MIT', distribution_model: 'binary' });
    const ident = makeIdentifierResult([
      { name: 'gpl-lib', license: 'GPL-3.0-only' },
    ]);

    const result = await runCompatibility(ctx, ident);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('CRITICAL');
    expect(result.findings[0].conflict_type).toBe('COPYLEFT_IN_PROPRIETARY');
  });

  it('detects Apache-2.0 + GPL-2.0 patent clause conflict', async () => {
    const ctx = makeCtx({ project_license: 'Apache-2.0' });
    const ident = makeIdentifierResult([
      { name: 'gpl2-lib', license: 'GPL-2.0-only' },
    ]);

    const result = await runCompatibility(ctx, ident);
    const patent = result.findings.find(f => f.conflict_type === 'PATENT_CLAUSE');
    expect(patent).toBeDefined();
    expect(patent!.severity).toBe('HIGH');
  });

  it('flags UNKNOWN license', async () => {
    const ctx = makeCtx();
    const ident = makeIdentifierResult([
      { name: 'mystery', license: 'UNKNOWN' },
    ]);

    const result = await runCompatibility(ctx, ident);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].conflict_type).toBe('UNKNOWN_LICENSE');
    expect(result.findings[0].severity).toBe('HIGH');
  });

  it('flags CUSTOM license', async () => {
    const ctx = makeCtx();
    const ident = makeIdentifierResult([
      { name: 'custom-pkg', license: 'CUSTOM' },
    ]);

    const result = await runCompatibility(ctx, ident);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].conflict_type).toBe('CUSTOM_LICENSE');
    expect(result.findings[0].severity).toBe('MEDIUM');
  });

  it('GPL in SaaS is LOW severity', async () => {
    const ctx = makeCtx({ project_license: 'MIT', distribution_model: 'saas' });
    const ident = makeIdentifierResult([
      { name: 'gpl-lib', license: 'GPL-3.0-only' },
    ]);

    const result = await runCompatibility(ctx, ident);
    const gplFinding = result.findings.find(f => f.package_name === 'gpl-lib');
    expect(gplFinding).toBeDefined();
    expect(gplFinding!.severity).toBe('LOW');
  });
});

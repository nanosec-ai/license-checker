import { describe, it, expect } from 'vitest';
import { runIdentifier } from '../../src/engines/identifier.js';
import type { EngineResult, ScanContext } from '../../src/types/index.js';

const ctx: ScanContext = {
  workDir: '/tmp/test',
  ecosystem: 'npm',
  manifest_content: '{}',
  project_name: 'test',
  project_version: '1.0.0',
  project_license: 'MIT',
  distribution_model: 'unknown',
  include_dev: false,
};

describe('identifier engine', () => {
  it('normalizes known license declarations', async () => {
    const resolver: EngineResult = {
      engine: 'resolver',
      findings: [],
      duration_ms: 0,
      resolved_deps: [
        {
          name: 'foo',
          version: '1.0.0',
          license_declared: 'MIT',
          license_file_content: null,
          purl: 'pkg:npm/foo@1.0.0',
          scope: 'required',
          integrity: null,
          is_direct: true,
          introduced_by: ['foo'],
          dependencies: [],
        },
      ],
    };

    const result = await runIdentifier(ctx, resolver);
    expect(result.license_map).toEqual({ 'MIT': 1 });
    expect(result.findings).toEqual([]);
  });

  it('flags unknown licenses', async () => {
    const resolver: EngineResult = {
      engine: 'resolver',
      findings: [],
      duration_ms: 0,
      resolved_deps: [
        {
          name: 'mystery',
          version: '1.0.0',
          license_declared: null,
          license_file_content: null,
          purl: 'pkg:npm/mystery@1.0.0',
          scope: 'required',
          integrity: null,
          is_direct: true,
          introduced_by: ['mystery'],
          dependencies: [],
        },
      ],
    };

    const result = await runIdentifier(ctx, resolver);
    expect(result.license_map!['UNKNOWN']).toBe(1);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].finding_id).toContain('LIC-UNKNOWN');
    expect(result.findings[0].severity).toBe('HIGH');
  });

  it('resolves OR expressions to permissive option', async () => {
    const resolver: EngineResult = {
      engine: 'resolver',
      findings: [],
      duration_ms: 0,
      resolved_deps: [
        {
          name: 'dual-pkg',
          version: '2.0.0',
          license_declared: '(MIT OR GPL-3.0-only)',
          license_file_content: null,
          purl: 'pkg:npm/dual-pkg@2.0.0',
          scope: 'required',
          integrity: null,
          is_direct: true,
          introduced_by: ['dual-pkg'],
          dependencies: [],
        },
      ],
    };

    const result = await runIdentifier(ctx, resolver);
    expect(result.license_map!['MIT']).toBe(1);
    expect(result.findings).toEqual([]);
  });

  it('detects license mismatch between declared and file content', async () => {
    const resolver: EngineResult = {
      engine: 'resolver',
      findings: [],
      duration_ms: 0,
      resolved_deps: [
        {
          name: 'mismatched',
          version: '1.0.0',
          license_declared: 'MIT',
          license_file_content: 'Apache License, Version 2.0\nLicensed under the Apache License',
          purl: 'pkg:npm/mismatched@1.0.0',
          scope: 'required',
          integrity: null,
          is_direct: true,
          introduced_by: ['mismatched'],
          dependencies: [],
        },
      ],
    };

    const result = await runIdentifier(ctx, resolver);
    const mismatch = result.findings.find(f => f.finding_id.includes('MISMATCH'));
    expect(mismatch).toBeDefined();
    expect(mismatch!.severity).toBe('MEDIUM');
  });

  it('identifies license from text when declared is missing', async () => {
    const resolver: EngineResult = {
      engine: 'resolver',
      findings: [],
      duration_ms: 0,
      resolved_deps: [
        {
          name: 'text-only',
          version: '1.0.0',
          license_declared: null,
          license_file_content: 'Permission is hereby granted, free of charge, to any person obtaining a copy of this software...',
          purl: 'pkg:npm/text-only@1.0.0',
          scope: 'required',
          integrity: null,
          is_direct: true,
          introduced_by: ['text-only'],
          dependencies: [],
        },
      ],
    };

    const result = await runIdentifier(ctx, resolver);
    expect(result.license_map!['MIT']).toBe(1);
    expect(result.findings).toEqual([]); // No unknown finding since we identified it
  });
});

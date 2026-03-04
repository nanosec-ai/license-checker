import { describe, it, expect } from 'vitest';
import { runAttribution } from '../../src/engines/attribution.js';
import type { EngineResult, ScanContext } from '../../src/types/index.js';

const ctx: ScanContext = {
  workDir: '/tmp/test',
  ecosystem: 'npm',
  manifest_content: '{}',
  project_name: 'test',
  project_version: '1.0.0',
  project_license: 'MIT',
  distribution_model: 'binary',
  include_dev: false,
};

describe('attribution engine', () => {
  it('generates attribution for MIT dependencies', async () => {
    const ident: EngineResult = {
      engine: 'identifier',
      findings: [],
      duration_ms: 0,
      resolved_deps: [
        {
          name: 'mit-lib',
          version: '1.0.0',
          license_declared: 'MIT',
          license_file_content: 'MIT License\n\nCopyright (c) 2024 John Doe\n\nPermission is hereby granted...',
          purl: 'pkg:npm/mit-lib@1.0.0',
          scope: 'required',
          integrity: null,
          is_direct: true,
          introduced_by: ['mit-lib'],
          dependencies: [],
        },
      ],
    };

    const result = await runAttribution(ctx, ident);
    expect(result.attribution_notices).toHaveLength(1);
    expect(result.attribution_notices![0].package_name).toBe('mit-lib');
    expect(result.attribution_notices![0].license).toBe('MIT');
    expect(result.attribution_notices![0].copyright_holders).toContain('John Doe');
  });

  it('skips attribution for licenses that do not require it', async () => {
    const ident: EngineResult = {
      engine: 'identifier',
      findings: [],
      duration_ms: 0,
      resolved_deps: [
        {
          name: 'unlicense-lib',
          version: '1.0.0',
          license_declared: 'Unlicense',
          license_file_content: 'This is free and unencumbered software...',
          purl: 'pkg:npm/unlicense-lib@1.0.0',
          scope: 'required',
          integrity: null,
          is_direct: true,
          introduced_by: ['unlicense-lib'],
          dependencies: [],
        },
      ],
    };

    const result = await runAttribution(ctx, ident);
    expect(result.attribution_notices).toHaveLength(0);
  });

  it('generates attribution for Apache-2.0 and BSD-3-Clause', async () => {
    const ident: EngineResult = {
      engine: 'identifier',
      findings: [],
      duration_ms: 0,
      resolved_deps: [
        {
          name: 'apache-lib',
          version: '2.0.0',
          license_declared: 'Apache-2.0',
          license_file_content: 'Copyright 2024 Apache Corp\nApache License, Version 2.0',
          purl: 'pkg:npm/apache-lib@2.0.0',
          scope: 'required',
          integrity: null,
          is_direct: true,
          introduced_by: ['apache-lib'],
          dependencies: [],
        },
        {
          name: 'bsd-lib',
          version: '3.0.0',
          license_declared: 'BSD-3-Clause',
          license_file_content: 'Copyright (c) 2024 BSD Author\nRedistribution and use in source and binary forms...',
          purl: 'pkg:npm/bsd-lib@3.0.0',
          scope: 'required',
          integrity: null,
          is_direct: true,
          introduced_by: ['bsd-lib'],
          dependencies: [],
        },
      ],
    };

    const result = await runAttribution(ctx, ident);
    expect(result.attribution_notices).toHaveLength(2);
    expect(result.attribution_notices![0].license).toBe('Apache-2.0');
    expect(result.attribution_notices![1].license).toBe('BSD-3-Clause');
  });
});

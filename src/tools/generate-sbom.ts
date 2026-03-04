import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Ecosystem, SbomOutput, ScanContext } from '../types/index.js';
import { runResolver } from '../engines/resolver.js';
import { runIdentifier } from '../engines/identifier.js';
import { generateCycloneDx } from '../sbom/cyclonedx.js';
import { generateSpdx } from '../sbom/spdx.js';
import { validateCycloneDx, validateSpdx } from '../sbom/validator.js';

const ENGINE_TIMEOUT = 30_000;

export interface GenerateSbomInput {
  package_json?: string;
  requirements_txt?: string;
  format?: 'cyclonedx' | 'spdx';
  include_dev?: boolean;
}

export async function handleGenerateSbom(input: GenerateSbomInput): Promise<SbomOutput> {
  const manifest = input.package_json ?? input.requirements_txt;
  if (!manifest) {
    throw new Error('Provide either package_json or requirements_txt');
  }

  const ecosystem: Ecosystem = input.package_json ? 'npm' : 'python';
  const format = input.format ?? 'cyclonedx';

  let projectName = 'unknown';
  let projectVersion: string | null = null;
  let projectLicense = 'UNKNOWN';

  if (ecosystem === 'npm') {
    try {
      const pkg = JSON.parse(input.package_json!);
      projectName = pkg.name ?? 'unknown';
      projectVersion = pkg.version ?? null;
      projectLicense = pkg.license ?? 'UNKNOWN';
    } catch {
      throw new Error('Invalid JSON in package_json');
    }
  }

  const workDir = await mkdtemp(join(tmpdir(), 'license-checker-sbom-'));

  try {
    const ctx: ScanContext = {
      workDir,
      ecosystem,
      manifest_content: manifest,
      project_name: projectName,
      project_version: projectVersion,
      project_license: projectLicense,
      distribution_model: 'unknown',
      include_dev: input.include_dev ?? false,
      policy: undefined,
    };

    const resolverResult = await withTimeout(runResolver(ctx), ENGINE_TIMEOUT, 'resolver');
    const identifierResult = await withTimeout(runIdentifier(ctx, resolverResult), ENGINE_TIMEOUT, 'identifier');

    const deps = identifierResult.resolved_deps ?? [];
    const licenseMap = identifierResult.license_map ?? {};

    let content: Record<string, unknown>;
    let validation;

    if (format === 'spdx') {
      content = generateSpdx({ project_name: projectName, project_version: projectVersion, deps, licenseMap });
      validation = validateSpdx(content);
    } else {
      content = generateCycloneDx({ project_name: projectName, project_version: projectVersion, deps, licenseMap });
      validation = validateCycloneDx(content);
    }

    return { format, content, validation };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Engine ${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

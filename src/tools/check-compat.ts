import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CompatibilityResult, DistributionModel, Ecosystem, ResolvedDep, ScanContext } from '../types/index.js';
import { runResolver } from '../engines/resolver.js';
import { runIdentifier } from '../engines/identifier.js';
import { runCompatibility } from '../engines/compatibility.js';
import { normalizeSpdxId } from '../data/license-db.js';

const ENGINE_TIMEOUT = 30_000;

export interface CheckCompatInput {
  package_json?: string;
  requirements_txt?: string;
  dependency_licenses?: string[];
  project_license: string;
  distribution_model?: DistributionModel;
  distribution?: DistributionModel;
  include_dev?: boolean;
}

export async function handleCheckCompat(input: CheckCompatInput): Promise<CompatibilityResult> {
  const distModel = input.distribution_model ?? input.distribution ?? 'binary';

  // Fast path: raw license identifiers provided directly
  if (input.dependency_licenses && input.dependency_licenses.length > 0) {
    return handleDirectLicenses(input.dependency_licenses, input.project_license, distModel);
  }

  const manifest = input.package_json ?? input.requirements_txt;
  if (!manifest) {
    throw new Error('Provide either package_json, requirements_txt, or dependency_licenses');
  }

  const ecosystem: Ecosystem = input.package_json ? 'npm' : 'python';

  let projectName = 'unknown';
  let projectVersion: string | null = null;

  if (ecosystem === 'npm') {
    try {
      const pkg = JSON.parse(input.package_json!);
      projectName = pkg.name ?? 'unknown';
      projectVersion = pkg.version ?? null;
    } catch {
      throw new Error('Invalid JSON in package_json');
    }
  }

  const workDir = await mkdtemp(join(tmpdir(), 'license-checker-compat-'));

  try {
    const ctx: ScanContext = {
      workDir,
      ecosystem,
      manifest_content: manifest,
      project_name: projectName,
      project_version: projectVersion,
      project_license: input.project_license,
      distribution_model: distModel,
      include_dev: input.include_dev ?? false,
      policy: undefined,
    };

    const resolverResult = await withTimeout(runResolver(ctx), ENGINE_TIMEOUT, 'resolver');
    const identifierResult = await withTimeout(runIdentifier(ctx, resolverResult), ENGINE_TIMEOUT, 'identifier');
    const compatResult = await withTimeout(runCompatibility(ctx, identifierResult), ENGINE_TIMEOUT, 'compatibility');

    return buildResult(compatResult.findings, input.project_license);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function handleDirectLicenses(
  licenses: string[],
  projectLicense: string,
  distributionModel: DistributionModel,
): Promise<CompatibilityResult> {
  // Synthesize resolved deps from raw license strings
  const deps: ResolvedDep[] = licenses.map((lic, i) => ({
    name: `dep-${i}`,
    version: '0.0.0',
    license_declared: normalizeSpdxId(lic),
    license_file_content: null,
    purl: `pkg:generic/dep-${i}@0.0.0`,
    scope: 'required' as const,
    integrity: null,
    is_direct: true,
    introduced_by: [`dep-${i}`],
    dependencies: [],
  }));

  const ctx: ScanContext = {
    workDir: '',
    ecosystem: 'npm',
    manifest_content: '{}',
    project_name: 'direct-check',
    project_version: null,
    project_license: projectLicense,
    distribution_model: distributionModel,
    include_dev: false,
    policy: undefined,
  };

  const identifierResult = {
    engine: 'identifier' as const,
    findings: [],
    duration_ms: 0,
    resolved_deps: deps,
  };

  const compatResult = await runCompatibility(ctx, identifierResult);
  return buildResult(compatResult.findings, projectLicense);
}

function buildResult(
  findings: { package_name: string; license_detected: string | null; conflict_type: string | null; introduced_by: string[]; severity: string; detail: string; remediation: string | null }[],
  projectLicense: string,
): CompatibilityResult {
  const conflicts = findings.map(f => ({
    dependency: f.package_name,
    dependency_license: f.license_detected ?? 'UNKNOWN',
    project_license: projectLicense,
    conflict_type: f.conflict_type as CompatibilityResult['conflicts'][number]['conflict_type'],
    introduced_by: f.introduced_by,
    severity: f.severity as CompatibilityResult['conflicts'][number]['severity'],
    explanation: f.detail,
    remediation: f.remediation ?? '',
  }));

  return {
    compatible: conflicts.length === 0,
    conflicts,
    summary: conflicts.length === 0
      ? 'All dependency licenses are compatible with your project license.'
      : `Found ${conflicts.length} license compatibility issue${conflicts.length > 1 ? 's' : ''}.`,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Engine ${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

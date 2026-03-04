import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DistributionModel, Ecosystem, EngineResult, LicenseAuditReport, PolicyConfig, ScanContext } from '../types/index.js';
import { runResolver } from '../engines/resolver.js';
import { runIdentifier } from '../engines/identifier.js';
import { runCompatibility } from '../engines/compatibility.js';
import { runPolicy } from '../engines/policy.js';
import { runAttribution } from '../engines/attribution.js';
import { buildLicenseReport } from '../report/builder.js';

const MAX_MANIFEST_SIZE = 500 * 1024; // 500KB
const ENGINE_TIMEOUT = 30_000;
const TOTAL_TIMEOUT = 180_000;

export interface CheckLicensesInput {
  package_json?: string;
  requirements_txt?: string;
  project_license?: string;
  distribution_model?: DistributionModel;
  include_dev?: boolean;
  policy?: PolicyConfig;
}

export async function handleCheckLicenses(input: CheckLicensesInput): Promise<LicenseAuditReport> {
  const startTime = performance.now();

  const manifest = input.package_json ?? input.requirements_txt;
  if (!manifest) {
    throw new Error('Provide either package_json or requirements_txt');
  }

  if (manifest.length > MAX_MANIFEST_SIZE) {
    throw new Error(`Manifest exceeds maximum size of ${MAX_MANIFEST_SIZE} bytes`);
  }

  const ecosystem: Ecosystem = input.package_json ? 'npm' : 'python';

  // Parse project info
  let projectName = 'unknown';
  let projectVersion: string | null = null;
  let projectLicense = input.project_license ?? 'UNKNOWN';

  if (ecosystem === 'npm') {
    try {
      const pkg = JSON.parse(input.package_json!);
      projectName = pkg.name ?? 'unknown';
      projectVersion = pkg.version ?? null;
      if (!input.project_license && pkg.license) {
        projectLicense = pkg.license;
      }
    } catch {
      throw new Error('Invalid JSON in package_json');
    }
  }

  const distributionModel = input.distribution_model ?? 'unknown';
  const workDir = await mkdtemp(join(tmpdir(), 'license-checker-'));

  try {
    const ctx: ScanContext = {
      workDir,
      ecosystem,
      manifest_content: manifest,
      project_name: projectName,
      project_version: projectVersion,
      project_license: projectLicense,
      distribution_model: distributionModel,
      include_dev: input.include_dev ?? true,
      policy: input.policy,
    };

    // Sequential pipeline: resolver → identifier → [compatibility | policy | attribution] in parallel
    const resolverResult = await withTimeout(runResolver(ctx), ENGINE_TIMEOUT, 'resolver');
    const identifierResult = await withTimeout(runIdentifier(ctx, resolverResult), ENGINE_TIMEOUT, 'identifier');

    // Run remaining engines in parallel
    const [compatResult, policyResult, attributionResult] = await Promise.all([
      withTimeout(runCompatibility(ctx, identifierResult), ENGINE_TIMEOUT, 'compatibility'),
      withTimeout(runPolicy(ctx, identifierResult), ENGINE_TIMEOUT, 'policy'),
      withTimeout(runAttribution(ctx, identifierResult), ENGINE_TIMEOUT, 'attribution'),
    ]);

    const engineResults: EngineResult[] = [
      resolverResult,
      identifierResult,
      compatResult,
      policyResult,
      attributionResult,
    ];

    return buildLicenseReport({
      ecosystem,
      target: projectName !== 'unknown' ? `inline:${projectName}` : 'inline:manifest',
      project_name: projectName,
      project_version: projectVersion,
      project_license: projectLicense,
      distribution_model: distributionModel,
      engineResults,
      startTime,
    });
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

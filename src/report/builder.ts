import { randomUUID } from 'node:crypto';
import type {
  Ecosystem, EngineResult, Finding, LicenseAuditReport,
  LicenseRemediation, ResolvedDep, SbomOutput,
} from '../types/index.js';
import { calculateScore, countSeverities, sortFindings } from '../scoring/scorer.js';
import { assessCraReadiness } from '../scoring/cra-readiness.js';
import { classifyLicense } from '../data/compatibility-matrix.js';

export function buildLicenseReport(opts: {
  ecosystem: Ecosystem;
  target: string;
  project_name: string;
  project_version: string | null;
  project_license: string;
  distribution_model: 'source' | 'binary' | 'saas' | 'unknown';
  engineResults: EngineResult[];
  startTime: number;
  sbom?: SbomOutput;
}): LicenseAuditReport {
  const {
    ecosystem, target, project_name, project_version,
    project_license, distribution_model, engineResults, startTime, sbom,
  } = opts;

  // Merge all findings
  const allFindings = engineResults.flatMap(r => r.findings);
  const sorted = sortFindings(allFindings);

  // Scoring
  const { compliance_score, risk_grade } = calculateScore(sorted);
  const severity_counts = countSeverities(sorted);

  // Dependency counts
  let direct = 0, transitive = 0, total = 0;
  let allDeps: ResolvedDep[] = [];
  for (const r of engineResults) {
    if (r.dep_counts) {
      direct = Math.max(direct, r.dep_counts.direct);
      transitive = Math.max(transitive, r.dep_counts.transitive);
      total = Math.max(total, r.dep_counts.total);
    }
    if (r.resolved_deps && r.resolved_deps.length > allDeps.length) {
      allDeps = r.resolved_deps;
    }
  }

  // License summary
  const licenseMap: Record<string, number> = {};
  for (const r of engineResults) {
    if (r.license_map) {
      for (const [lic, count] of Object.entries(r.license_map)) {
        licenseMap[lic] = (licenseMap[lic] ?? 0) + count;
      }
    }
  }

  let unknownCount = 0, customCount = 0, copyleftCount = 0, permissiveCount = 0;
  for (const [lic, count] of Object.entries(licenseMap)) {
    const cls = classifyLicense(lic);
    if (cls === 'unknown') unknownCount += count;
    else if (cls === 'custom') customCount += count;
    else if (cls === 'copyleft' || cls === 'weak-copyleft') copyleftCount += count;
    else if (cls === 'permissive' || cls === 'public-domain') permissiveCount += count;
  }

  // Policy result
  const policyFindings = sorted.filter(f => f.engine === 'policy');
  const deniedViolations = policyFindings.filter(f => f.finding_id.startsWith('POL-DENIED')).length;
  const allowedViolations = policyFindings.filter(f => f.finding_id.startsWith('POL-NOT-ALLOWED')).length;
  const hasCritOrHigh = policyFindings.some(f => f.severity === 'CRITICAL' || f.severity === 'HIGH');

  // CRA readiness
  const cra_readiness = assessCraReadiness({
    deps: allDeps,
    licenseMap,
    sbom,
  });

  // Top remediations
  const top_remediations = buildTopRemediations(sorted);

  return {
    audit_id: randomUUID(),
    timestamp: new Date().toISOString(),
    audit_target: target,
    ecosystem,
    scan_duration_ms: performance.now() - startTime,

    project_name,
    project_version,
    project_license,
    distribution_model,

    total_dependencies: total,
    direct_dependencies: direct,
    transitive_dependencies: transitive,

    license_summary: {
      total_licenses_detected: Object.keys(licenseMap).length,
      license_distribution: licenseMap,
      unknown_count: unknownCount,
      custom_count: customCount,
      copyleft_count: copyleftCount,
      permissive_count: permissiveCount,
    },

    severity_counts,
    compliance_score,
    risk_grade,
    findings: sorted,

    policy_result: {
      policy_applied: policyFindings.length > 0 || sorted.some(f => f.engine === 'policy'),
      denied_violations: deniedViolations,
      allowed_violations: allowedViolations,
      pass: !hasCritOrHigh,
    },

    cra_readiness,
    top_remediations,
  };
}

function buildTopRemediations(findings: Finding[]): LicenseRemediation[] {
  const byPackage = new Map<string, Finding[]>();
  for (const f of findings) {
    if (f.severity === 'INFO') continue;
    const list = byPackage.get(f.package_name) ?? [];
    list.push(f);
    byPackage.set(f.package_name, list);
  }

  const remediations: LicenseRemediation[] = [];
  for (const [pkg, pkgFindings] of byPackage) {
    const worst = pkgFindings[0]; // already sorted by severity
    remediations.push({
      package_name: pkg,
      current_license: worst.license_detected ?? 'UNKNOWN',
      issue: worst.title,
      action: worst.remediation ?? `Review the license of ${pkg}`,
      impact: `Resolves ${pkgFindings.length} compliance finding${pkgFindings.length > 1 ? 's' : ''}`,
    });
  }

  // Sort by count desc, take top 5
  remediations.sort((a, b) => {
    const aCount = parseInt(a.impact.match(/\d+/)?.[0] ?? '0');
    const bCount = parseInt(b.impact.match(/\d+/)?.[0] ?? '0');
    return bCount - aCount;
  });

  return remediations.slice(0, 5);
}

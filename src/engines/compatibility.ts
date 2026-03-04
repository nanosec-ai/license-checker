import type { EngineResult, Finding, ResolvedDep, ScanContext } from '../types/index.js';
import { checkCompatibility } from '../data/compatibility-matrix.js';

export async function runCompatibility(
  ctx: ScanContext,
  identifierResult: EngineResult,
): Promise<EngineResult> {
  const start = performance.now();
  const findings: Finding[] = [];
  const deps = identifierResult.resolved_deps ?? [];

  for (const dep of deps) {
    const license = dep.license_declared ?? 'UNKNOWN';

    const conflict = checkCompatibility({
      dep_name: dep.name,
      dep_license: license,
      project_license: ctx.project_license,
      distribution_model: ctx.distribution_model,
      introduced_by: dep.introduced_by,
    });

    if (conflict) {
      // Apply transitive multiplier context
      const isTransitive = !dep.is_direct;
      const findingId = buildFindingId(conflict.conflict_type, license, dep.name);

      findings.push({
        engine: 'compatibility',
        severity: conflict.severity,
        package_name: dep.name,
        package_version: dep.version,
        finding_id: findingId,
        title: `${conflict.conflict_type}: ${license} in ${ctx.project_license} project`,
        detail: conflict.explanation + (isTransitive
          ? ` This is a transitive dependency (introduced via ${dep.introduced_by.join(' → ')}), making it harder to detect and remediate.`
          : ''),
        license_detected: license,
        introduced_by: dep.introduced_by,
        conflict_type: conflict.conflict_type,
        remediation: conflict.remediation,
        references: [
          `https://spdx.org/licenses/${license}.html`,
          'https://www.gnu.org/licenses/gpl-faq.html',
        ],
      });
    }
  }

  return {
    engine: 'compatibility',
    findings,
    duration_ms: performance.now() - start,
  };
}

function buildFindingId(conflictType: string, license: string, pkg: string): string {
  const licShort = license.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  switch (conflictType) {
    case 'AGPL_NETWORK':
      return `LIC-AGPL-NETWORK-${pkg}`;
    case 'COPYLEFT_IN_PROPRIETARY':
      return `LIC-COPYLEFT-IN-PROPRIETARY-${pkg}`;
    case 'INCOMPATIBLE_COPYLEFT':
      return `LIC-INCOMPATIBLE-${licShort}-${pkg}`;
    case 'PATENT_CLAUSE':
      return `LIC-PATENT-${licShort}-${pkg}`;
    case 'UNKNOWN_LICENSE':
      return `LIC-UNKNOWN-COMPAT-${pkg}`;
    case 'CUSTOM_LICENSE':
      return `LIC-CUSTOM-COMPAT-${pkg}`;
    default:
      return `LIC-COMPAT-${pkg}`;
  }
}

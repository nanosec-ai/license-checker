import type { EngineResult, Finding, ResolvedDep, ScanContext } from '../types/index.js';
import { normalizeSpdxId, identifyLicenseFromText } from '../data/license-db.js';
import { getCachedLicense, setCachedLicense } from '../cache/license-cache.js';

export async function runIdentifier(
  ctx: ScanContext,
  resolverResult: EngineResult,
): Promise<EngineResult> {
  const start = performance.now();
  const findings: Finding[] = [];
  const license_map: Record<string, number> = {};
  const deps = resolverResult.resolved_deps ?? [];

  for (const dep of deps) {
    // Check cache first
    const cached = getCachedLicense(dep.name, dep.version);
    if (cached) {
      dep.license_declared = cached;
      license_map[cached] = (license_map[cached] ?? 0) + 1;
      continue;
    }

    // Step 1: Normalize declared license
    let resolved = normalizeSpdxId(dep.license_declared);

    // Step 2: Handle SPDX OR expressions — pick the permissive option
    if (resolved.includes(' OR ') || resolved.includes(' or ')) {
      resolved = resolveOrExpression(resolved);
    }

    // Step 3: If still unknown, try fingerprint matching on license file content
    if (resolved === 'UNKNOWN' && dep.license_file_content) {
      resolved = identifyLicenseFromText(dep.license_file_content);
    }

    // Step 4: If license_declared was null/empty and we couldn't identify → UNKNOWN
    if (resolved === 'UNKNOWN') {
      findings.push({
        engine: 'identifier',
        severity: 'HIGH',
        package_name: dep.name,
        package_version: dep.version,
        finding_id: `LIC-UNKNOWN-${dep.name}`,
        title: `Unknown license for ${dep.name}@${dep.version}`,
        detail: `No license information could be determined for this package. The package.json license field is missing or unrecognizable, and no LICENSE file content was available for fingerprint matching.`,
        license_detected: 'UNKNOWN',
        introduced_by: dep.introduced_by,
        conflict_type: null,
        remediation: `Manually check the license of ${dep.name} on its repository/registry page.`,
        references: [`https://www.npmjs.com/package/${dep.name}`],
      });
    }

    // Step 5: Check for mismatch between declared and detected
    if (dep.license_file_content && dep.license_declared) {
      const textDetected = identifyLicenseFromText(dep.license_file_content);
      const declaredNorm = normalizeSpdxId(dep.license_declared);
      if (textDetected !== 'UNKNOWN' && declaredNorm !== textDetected && !declaredNorm.includes(' OR ')) {
        findings.push({
          engine: 'identifier',
          severity: 'MEDIUM',
          package_name: dep.name,
          package_version: dep.version,
          finding_id: `LIC-MISMATCH-${dep.name}`,
          title: `License mismatch for ${dep.name}@${dep.version}`,
          detail: `Declared license (${declaredNorm}) does not match detected license from LICENSE file (${textDetected}).`,
          license_detected: textDetected,
          introduced_by: dep.introduced_by,
          conflict_type: null,
          remediation: `Verify which license actually applies to ${dep.name}. The LICENSE file content suggests ${textDetected} but package.json declares ${declaredNorm}.`,
          references: [],
        });
      }
    }

    // Update the dep's resolved license
    dep.license_declared = resolved;
    license_map[resolved] = (license_map[resolved] ?? 0) + 1;

    // Cache the result
    setCachedLicense(dep.name, dep.version, resolved);
  }

  return {
    engine: 'identifier',
    findings,
    duration_ms: performance.now() - start,
    resolved_deps: deps,
    license_map,
  };
}

/**
 * Resolve an SPDX OR expression by preferring the permissive option.
 * E.g., "(MIT OR GPL-3.0-only)" → "MIT"
 */
function resolveOrExpression(expr: string): string {
  // Strip outer parens
  const clean = expr.replace(/^\(|\)$/g, '').trim();
  const parts = clean.split(/\s+OR\s+/i).map(p => p.trim());

  const PERMISSIVE_PRIORITY = [
    'MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'Unlicense',
    'CC0-1.0', 'WTFPL', 'Zlib', 'BlueOak-1.0.0', 'Apache-2.0',
    'Artistic-2.0', 'BSL-1.0',
  ];

  for (const preferred of PERMISSIVE_PRIORITY) {
    const normalized = parts.map(p => normalizeSpdxId(p));
    const idx = normalized.indexOf(preferred);
    if (idx !== -1) return preferred;
  }

  // Fallback: return first option normalized
  return normalizeSpdxId(parts[0]);
}

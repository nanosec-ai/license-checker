import type { EngineResult, Finding, ScanContext } from '../types/index.js';

const DEFAULT_DENIED = ['AGPL-3.0-only', 'AGPL-3.0-or-later', 'SSPL-1.0', 'EUPL-1.1', 'EUPL-1.2'];

export async function runPolicy(
  ctx: ScanContext,
  identifierResult: EngineResult,
): Promise<EngineResult> {
  const start = performance.now();
  const findings: Finding[] = [];
  const deps = identifierResult.resolved_deps ?? [];

  const policy = ctx.policy ?? { denied: DEFAULT_DENIED };
  const allowedSet = policy.allowed ? new Set(policy.allowed) : null;
  const deniedSet = new Set(policy.denied ?? DEFAULT_DENIED);

  for (const dep of deps) {
    const license = dep.license_declared ?? 'UNKNOWN';

    // Skip UNKNOWN — handled by identifier engine
    if (license === 'UNKNOWN') continue;

    // Check denied list
    if (deniedSet.has(license)) {
      // If also in allowed list, allowed takes precedence
      if (allowedSet && allowedSet.has(license)) continue;

      findings.push({
        engine: 'policy',
        severity: 'HIGH',
        package_name: dep.name,
        package_version: dep.version,
        finding_id: `POL-DENIED-${license.replace(/[^A-Za-z0-9]/g, '')}-${dep.name}`,
        title: `Policy violation: ${license} is denied`,
        detail: `The license ${license} for ${dep.name}@${dep.version} is on the denied license list.`,
        license_detected: license,
        introduced_by: dep.introduced_by,
        conflict_type: null,
        remediation: `Replace ${dep.name} with an alternative that uses an approved license.`,
        references: [`https://spdx.org/licenses/${license}.html`],
      });
    }

    // Check allowed list (if set): anything NOT in allowed is a violation
    if (allowedSet && !allowedSet.has(license)) {
      findings.push({
        engine: 'policy',
        severity: 'MEDIUM',
        package_name: dep.name,
        package_version: dep.version,
        finding_id: `POL-NOT-ALLOWED-${license.replace(/[^A-Za-z0-9]/g, '')}-${dep.name}`,
        title: `Policy violation: ${license} is not in allowed list`,
        detail: `The license ${license} for ${dep.name}@${dep.version} is not in the approved license list.`,
        license_detected: license,
        introduced_by: dep.introduced_by,
        conflict_type: null,
        remediation: `Either add ${license} to the allowed list or replace ${dep.name} with a package using an approved license.`,
        references: [`https://spdx.org/licenses/${license}.html`],
      });
    }
  }

  return {
    engine: 'policy',
    findings,
    duration_ms: performance.now() - start,
  };
}

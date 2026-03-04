import type { CraReadiness, ResolvedDep, SbomOutput } from '../types/index.js';

export function assessCraReadiness(opts: {
  deps: ResolvedDep[];
  licenseMap: Record<string, number>;
  sbom?: SbomOutput;
  sbomRequired?: boolean;
}): CraReadiness {
  const { deps, licenseMap, sbom } = opts;
  // When sbomRequired is explicitly true (or an SBOM is provided), SBOM criteria
  // count toward the score. When false/undefined and no SBOM, score only data
  // completeness and scale proportionally.
  const sbomInScope = opts.sbomRequired === true || !!sbom;
  const gaps: string[] = [];

  // --- Data completeness dimensions (always scored) ---

  // All dependencies have identified licenses
  const unknownCount = licenseMap['UNKNOWN'] ?? 0;
  const customCount = licenseMap['CUSTOM'] ?? 0;
  const allIdentified = deps.length === 0 || (unknownCount === 0 && customCount === 0);

  // No UNKNOWN licenses
  const noUnknowns = unknownCount === 0;

  // All components have purl identifiers
  const allPurls = deps.length === 0 || deps.every(d => d.purl && d.purl.length > 0);

  // --- SBOM dimensions ---
  const sbomGenerated = !!sbom;
  const sbomValid = sbom?.validation.valid ?? false;

  if (sbomInScope) {
    // Full 100-point scale: SBOM counts
    let score = 0;

    if (sbomGenerated) { score += 25; } else { gaps.push('No SBOM generated in CycloneDX or SPDX format'); }
    if (allIdentified) { score += 25; } else { gaps.push(`${unknownCount + customCount} dependencies have unidentified or custom licenses`); }
    if (noUnknowns) { score += 20; } else { gaps.push(`${unknownCount} dependencies have UNKNOWN licenses`); }
    if (allPurls) { score += 15; } else { gaps.push('Some components are missing purl identifiers'); }
    if (sbomValid) { score += 15; } else if (sbomGenerated) { gaps.push('SBOM failed schema validation'); } else { gaps.push('SBOM not generated — cannot validate'); }

    return {
      sbom_generated: sbomGenerated,
      all_licenses_identified: allIdentified,
      no_unknown_licenses: noUnknowns,
      vulnerability_reporting_ready: sbomGenerated,
      purls_present: allPurls,
      sbom_valid: sbomValid,
      readiness_score: score,
      gaps,
    };
  }

  // SBOM not in scope — score data completeness only, scaled to 100
  // Data dimensions: allIdentified (weight 42), noUnknowns (weight 33), allPurls (weight 25)
  let score = 0;

  if (allIdentified) { score += 42; } else { gaps.push(`${unknownCount + customCount} dependencies have unidentified or custom licenses`); }
  if (noUnknowns) { score += 33; } else { gaps.push(`${unknownCount} dependencies have UNKNOWN licenses`); }
  if (allPurls) { score += 25; } else { gaps.push('Some components are missing purl identifiers'); }

  // Actionable gap instead of penalty
  gaps.push('Run generate_sbom to produce the required SBOM artifact');

  return {
    sbom_generated: false,
    all_licenses_identified: allIdentified,
    no_unknown_licenses: noUnknowns,
    vulnerability_reporting_ready: false,
    purls_present: allPurls,
    sbom_valid: false,
    readiness_score: score,
    gaps,
  };
}

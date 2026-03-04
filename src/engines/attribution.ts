import type { AttributionNotice, EngineResult, Finding, ScanContext } from '../types/index.js';
import { getLicenseInfo } from '../data/license-db.js';

export async function runAttribution(
  ctx: ScanContext,
  identifierResult: EngineResult,
): Promise<EngineResult> {
  const start = performance.now();
  const findings: Finding[] = [];
  const attribution_notices: AttributionNotice[] = [];
  const deps = identifierResult.resolved_deps ?? [];

  for (const dep of deps) {
    const license = dep.license_declared ?? 'UNKNOWN';
    const licInfo = getLicenseInfo(license);

    // Only generate attribution for licenses that require it
    if (!licInfo?.requires_attribution) continue;

    // Extract copyright holders from license text
    const copyrightHolders = dep.license_file_content
      ? extractCopyrightHolders(dep.license_file_content)
      : ['Copyright holders not available'];

    const licenseText = dep.license_file_content ?? `Licensed under ${license}`;

    attribution_notices.push({
      package_name: dep.name,
      package_version: dep.version,
      license,
      copyright_holders: copyrightHolders,
      license_text: licenseText,
      notice_text: null,
    });
  }

  return {
    engine: 'attribution',
    findings,
    duration_ms: performance.now() - start,
    attribution_notices,
  };
}

/**
 * Extract copyright holder lines from a LICENSE file.
 */
function extractCopyrightHolders(text: string): string[] {
  const holders: string[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Match "Copyright (c) YYYY Name" or "Copyright YYYY Name" patterns
    const match = trimmed.match(
      /^Copyright\s+(?:\(c\)\s+)?(?:\d{4}(?:\s*[-–,]\s*\d{4})?\s+)?(.+)/i,
    );
    if (match) {
      const holder = match[1].replace(/\.\s*All rights reserved\.?/i, '').trim();
      if (holder) holders.push(holder);
    }
  }

  return holders.length > 0 ? holders : ['Unknown copyright holder'];
}

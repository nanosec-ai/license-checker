import type { CompatibilityConflict, DistributionModel, Severity } from '../types/index.js';
import { isCopyleft, isPermissive } from './spdx-licenses.js';

type ConflictType = CompatibilityConflict['conflict_type'];

interface CompatRule {
  dep_license: string | string[];
  project_license: string | string[] | ((lic: string) => boolean);
  distribution?: DistributionModel[];
  conflict_type: ConflictType;
  severity: Severity;
  explanation: string;
  remediation: string;
}

// Permissive licenses that are compatible with everything
const PERMISSIVE_SET = new Set([
  'MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Zlib', '0BSD',
  'Unlicense', 'CC0-1.0', 'WTFPL', 'BlueOak-1.0.0', 'Artistic-2.0',
]);

const PROPRIETARY_LIKE = (lic: string) => {
  const lower = lic.toLowerCase();
  return lower === 'proprietary' ||
    lower === 'unlicensed' ||
    PERMISSIVE_SET.has(lic); // MIT/ISC/BSD projects using copyleft deps in binary dist
};

const COMPAT_RULES: CompatRule[] = [
  // AGPL: network copyleft — CRITICAL for everything non-AGPL
  {
    dep_license: ['AGPL-3.0-only', 'AGPL-3.0-or-later'],
    project_license: (lic: string) => !lic.startsWith('AGPL'),
    conflict_type: 'AGPL_NETWORK',
    severity: 'CRITICAL',
    explanation: 'AGPL-3.0 requires that users interacting over a network receive the source code. This applies even to SaaS deployments.',
    remediation: 'Remove this dependency or relicense your project under AGPL-3.0.',
  },
  // GPL in proprietary/permissive binary distribution
  {
    dep_license: ['GPL-2.0-only', 'GPL-2.0-or-later', 'GPL-3.0-only', 'GPL-3.0-or-later'],
    project_license: PROPRIETARY_LIKE,
    distribution: ['binary'],
    conflict_type: 'COPYLEFT_IN_PROPRIETARY',
    severity: 'CRITICAL',
    explanation: 'GPL-licensed dependency in a proprietary/permissive project distributed as a binary. GPL requires the entire combined work to be licensed under GPL.',
    remediation: 'Replace with a permissive-licensed alternative or relicense your project under GPL.',
  },
  // GPL in source distribution (also problematic)
  {
    dep_license: ['GPL-2.0-only', 'GPL-2.0-or-later', 'GPL-3.0-only', 'GPL-3.0-or-later'],
    project_license: PROPRIETARY_LIKE,
    distribution: ['source'],
    conflict_type: 'COPYLEFT_IN_PROPRIETARY',
    severity: 'CRITICAL',
    explanation: 'GPL-licensed dependency in a proprietary/permissive project. If you distribute source that links to GPL code, the combined work must be GPL-licensed.',
    remediation: 'Replace with a permissive-licensed alternative or relicense your project under GPL.',
  },
  // GPL in SaaS (non-AGPL GPL) — informational only
  {
    dep_license: ['GPL-2.0-only', 'GPL-2.0-or-later', 'GPL-3.0-only', 'GPL-3.0-or-later'],
    project_license: () => true,
    distribution: ['saas'],
    conflict_type: 'COPYLEFT_IN_PROPRIETARY',
    severity: 'LOW',
    explanation: 'GPL dependency in SaaS deployment. GPL copyleft is not triggered by network use (only AGPL). However, if you distribute binaries or containers, GPL obligations apply.',
    remediation: 'No immediate action for pure SaaS, but monitor for distribution changes.',
  },
  // Apache-2.0 + GPL-2.0 patent clause conflict
  {
    dep_license: 'GPL-2.0-only',
    project_license: 'Apache-2.0',
    conflict_type: 'PATENT_CLAUSE',
    severity: 'HIGH',
    explanation: 'Apache-2.0 patent clause is incompatible with GPL-2.0. The FSF and Apache Foundation agree these licenses are incompatible.',
    remediation: 'Use a GPL-3.0 compatible alternative, or replace the GPL-2.0 dependency.',
  },
  // LGPL with static linking concerns
  {
    dep_license: ['LGPL-2.1-only', 'LGPL-2.1-or-later', 'LGPL-3.0-only', 'LGPL-3.0-or-later'],
    project_license: PROPRIETARY_LIKE,
    distribution: ['binary'],
    conflict_type: 'INCOMPATIBLE_COPYLEFT',
    severity: 'HIGH',
    explanation: 'LGPL dependency in proprietary binary distribution. LGPL allows use in proprietary software only if dynamically linked. Static linking or bundling triggers copyleft obligations.',
    remediation: 'Ensure dynamic linking, or replace with a permissive-licensed alternative.',
  },
];

export type LicenseClass = 'permissive' | 'copyleft' | 'weak-copyleft' | 'public-domain' | 'unknown' | 'custom';

export function classifyLicense(spdxId: string): LicenseClass {
  if (spdxId === 'UNKNOWN') return 'unknown';
  if (spdxId === 'CUSTOM') return 'custom';
  if (PERMISSIVE_SET.has(spdxId)) return 'permissive';
  if (['Unlicense', 'CC0-1.0'].includes(spdxId)) return 'public-domain';

  const copyleftIds = ['GPL-2.0-only', 'GPL-2.0-or-later', 'GPL-3.0-only', 'GPL-3.0-or-later',
    'AGPL-3.0-only', 'AGPL-3.0-or-later', 'SSPL-1.0'];
  if (copyleftIds.includes(spdxId)) return 'copyleft';

  const weakCopyleft = ['LGPL-2.1-only', 'LGPL-2.1-or-later', 'LGPL-3.0-only', 'LGPL-3.0-or-later',
    'MPL-2.0', 'EPL-1.0', 'EPL-2.0', 'EUPL-1.1', 'EUPL-1.2', 'CPAL-1.0'];
  if (weakCopyleft.includes(spdxId)) return 'weak-copyleft';

  if (isPermissive(spdxId)) return 'permissive';
  if (isCopyleft(spdxId)) return 'copyleft';

  return 'unknown';
}

export interface CompatCheckInput {
  dep_name: string;
  dep_license: string;
  project_license: string;
  distribution_model: DistributionModel;
  introduced_by: string[];
}

/**
 * Check if a single dependency license is compatible with the project license.
 * Returns a conflict object if incompatible, undefined if compatible.
 */
export function checkCompatibility(input: CompatCheckInput): CompatibilityConflict | undefined {
  const { dep_name, dep_license, project_license, distribution_model, introduced_by } = input;

  // Permissive deps are always compatible
  if (PERMISSIVE_SET.has(dep_license)) return undefined;

  // UNKNOWN/CUSTOM always flagged
  if (dep_license === 'UNKNOWN') {
    return {
      dependency: dep_name,
      dependency_license: dep_license,
      project_license,
      conflict_type: 'UNKNOWN_LICENSE',
      introduced_by,
      severity: 'HIGH',
      explanation: 'Dependency has an unknown or undetectable license. Cannot verify compliance.',
      remediation: 'Manually verify the license of this dependency before shipping.',
    };
  }

  if (dep_license === 'CUSTOM') {
    return {
      dependency: dep_name,
      dependency_license: dep_license,
      project_license,
      conflict_type: 'CUSTOM_LICENSE',
      introduced_by,
      severity: 'MEDIUM',
      explanation: 'Dependency uses a custom/non-standard license. Automated compliance checking is not possible.',
      remediation: 'Manually review the license text and consult legal counsel if necessary.',
    };
  }

  // Check against rule set
  for (const rule of COMPAT_RULES) {
    // Match dep license
    const depLicenses = Array.isArray(rule.dep_license) ? rule.dep_license : [rule.dep_license];
    if (!depLicenses.includes(dep_license)) continue;

    // Match project license
    if (typeof rule.project_license === 'function') {
      if (!rule.project_license(project_license)) continue;
    } else {
      const projLicenses = Array.isArray(rule.project_license) ? rule.project_license : [rule.project_license];
      if (!projLicenses.includes(project_license)) continue;
    }

    // Match distribution model
    if (rule.distribution && !rule.distribution.includes(distribution_model)) continue;

    return {
      dependency: dep_name,
      dependency_license: dep_license,
      project_license,
      conflict_type: rule.conflict_type,
      introduced_by,
      severity: rule.severity,
      explanation: rule.explanation,
      remediation: rule.remediation,
    };
  }

  return undefined;
}

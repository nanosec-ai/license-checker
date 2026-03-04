import type { LicenseInfo } from '../types/index.js';

export const LICENSE_DB: LicenseInfo[] = [
  {
    spdx_id: 'MIT',
    name: 'MIT License',
    is_osi_approved: true,
    classification: 'permissive',
    key_phrases: ['Permission is hereby granted, free of charge'],
    requires_attribution: true,
    copyleft_type: 'none',
  },
  {
    spdx_id: 'Apache-2.0',
    name: 'Apache License 2.0',
    is_osi_approved: true,
    classification: 'permissive',
    key_phrases: ['Apache License, Version 2.0', 'Licensed under the Apache License'],
    requires_attribution: true,
    copyleft_type: 'none',
  },
  {
    spdx_id: 'BSD-2-Clause',
    name: 'BSD 2-Clause "Simplified" License',
    is_osi_approved: true,
    classification: 'permissive',
    key_phrases: ['Redistribution and use in source and binary forms'],
    requires_attribution: true,
    copyleft_type: 'none',
  },
  {
    spdx_id: 'BSD-3-Clause',
    name: 'BSD 3-Clause "New" or "Revised" License',
    is_osi_approved: true,
    classification: 'permissive',
    key_phrases: ['Redistribution and use in source and binary forms', 'Neither the name'],
    requires_attribution: true,
    copyleft_type: 'none',
  },
  {
    spdx_id: 'ISC',
    name: 'ISC License',
    is_osi_approved: true,
    classification: 'permissive',
    key_phrases: ['Permission to use, copy, modify, and/or distribute'],
    requires_attribution: true,
    copyleft_type: 'none',
  },
  {
    spdx_id: 'GPL-2.0-only',
    name: 'GNU General Public License v2.0 only',
    is_osi_approved: true,
    classification: 'copyleft',
    key_phrases: ['GNU General Public License', 'Version 2, June 1991'],
    requires_attribution: true,
    copyleft_type: 'strong',
  },
  {
    spdx_id: 'GPL-3.0-only',
    name: 'GNU General Public License v3.0 only',
    is_osi_approved: true,
    classification: 'copyleft',
    key_phrases: ['GNU General Public License', 'Version 3, 29 June 2007'],
    requires_attribution: true,
    copyleft_type: 'strong',
  },
  {
    spdx_id: 'LGPL-2.1-only',
    name: 'GNU Lesser General Public License v2.1 only',
    is_osi_approved: true,
    classification: 'weak-copyleft',
    key_phrases: ['GNU Lesser General Public License', 'Version 2.1'],
    requires_attribution: true,
    copyleft_type: 'weak',
  },
  {
    spdx_id: 'LGPL-3.0-only',
    name: 'GNU Lesser General Public License v3.0 only',
    is_osi_approved: true,
    classification: 'weak-copyleft',
    key_phrases: ['GNU Lesser General Public License', 'Version 3'],
    requires_attribution: true,
    copyleft_type: 'weak',
  },
  {
    spdx_id: 'AGPL-3.0-only',
    name: 'GNU Affero General Public License v3.0',
    is_osi_approved: true,
    classification: 'copyleft',
    key_phrases: ['GNU Affero General Public License', 'Version 3'],
    requires_attribution: true,
    copyleft_type: 'network',
  },
  {
    spdx_id: 'MPL-2.0',
    name: 'Mozilla Public License 2.0',
    is_osi_approved: true,
    classification: 'weak-copyleft',
    key_phrases: ['Mozilla Public License Version 2.0'],
    requires_attribution: true,
    copyleft_type: 'weak',
  },
  {
    spdx_id: 'Unlicense',
    name: 'The Unlicense',
    is_osi_approved: true,
    classification: 'public-domain',
    key_phrases: ['This is free and unencumbered software'],
    requires_attribution: false,
    copyleft_type: 'none',
  },
  {
    spdx_id: 'CC0-1.0',
    name: 'Creative Commons Zero v1.0 Universal',
    is_osi_approved: false,
    classification: 'public-domain',
    key_phrases: ['CC0 1.0 Universal', 'Creative Commons Zero'],
    requires_attribution: false,
    copyleft_type: 'none',
  },
  {
    spdx_id: 'WTFPL',
    name: 'Do What The F*ck You Want To Public License',
    is_osi_approved: false,
    classification: 'permissive',
    key_phrases: ['DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE'],
    requires_attribution: false,
    copyleft_type: 'none',
  },
  {
    spdx_id: 'Artistic-2.0',
    name: 'Artistic License 2.0',
    is_osi_approved: true,
    classification: 'permissive',
    key_phrases: ['The Artistic License 2.0'],
    requires_attribution: true,
    copyleft_type: 'none',
  },
  {
    spdx_id: 'Zlib',
    name: 'zlib License',
    is_osi_approved: true,
    classification: 'permissive',
    key_phrases: ["This software is provided 'as-is'", 'be misrepresented'],
    requires_attribution: false,
    copyleft_type: 'none',
  },
  {
    spdx_id: '0BSD',
    name: 'BSD Zero Clause License',
    is_osi_approved: true,
    classification: 'permissive',
    key_phrases: ['Permission to use, copy, modify', '0-clause BSD'],
    requires_attribution: false,
    copyleft_type: 'none',
  },
  {
    spdx_id: 'BlueOak-1.0.0',
    name: 'Blue Oak Model License 1.0.0',
    is_osi_approved: false,
    classification: 'permissive',
    key_phrases: ['Blue Oak Model License'],
    requires_attribution: true,
    copyleft_type: 'none',
  },
];

// Build index for fast lookups
const DB_BY_SPDX = new Map<string, LicenseInfo>();
for (const lic of LICENSE_DB) {
  DB_BY_SPDX.set(lic.spdx_id.toLowerCase(), lic);
}

// Common aliases → SPDX
const SPDX_ALIASES: Record<string, string> = {
  'mit': 'MIT',
  'apache 2.0': 'Apache-2.0',
  'apache-2': 'Apache-2.0',
  'apache2': 'Apache-2.0',
  'apache license 2.0': 'Apache-2.0',
  'bsd': 'BSD-2-Clause',
  'bsd-2': 'BSD-2-Clause',
  'bsd-3': 'BSD-3-Clause',
  'bsd 2-clause': 'BSD-2-Clause',
  'bsd 3-clause': 'BSD-3-Clause',
  'isc': 'ISC',
  'gpl-2.0': 'GPL-2.0-only',
  'gpl-2': 'GPL-2.0-only',
  'gpl2': 'GPL-2.0-only',
  'gplv2': 'GPL-2.0-only',
  'gpl-3.0': 'GPL-3.0-only',
  'gpl-3': 'GPL-3.0-only',
  'gpl3': 'GPL-3.0-only',
  'gplv3': 'GPL-3.0-only',
  'lgpl-2.1': 'LGPL-2.1-only',
  'lgpl-3.0': 'LGPL-3.0-only',
  'lgpl2': 'LGPL-2.1-only',
  'lgpl3': 'LGPL-3.0-only',
  'agpl-3.0': 'AGPL-3.0-only',
  'agpl3': 'AGPL-3.0-only',
  'agpl-3.0-or-later': 'AGPL-3.0-only',
  'mpl-2.0': 'MPL-2.0',
  'mpl2': 'MPL-2.0',
  'unlicense': 'Unlicense',
  'cc0': 'CC0-1.0',
  'cc0-1.0': 'CC0-1.0',
  'wtfpl': 'WTFPL',
  'artistic-2.0': 'Artistic-2.0',
  'zlib': 'Zlib',
  '0bsd': '0BSD',
  'blueoak-1.0.0': 'BlueOak-1.0.0',
  // npm-specific
  '(mit)': 'MIT',
  'apache license, version 2.0': 'Apache-2.0',
  'bsd-2-clause': 'BSD-2-Clause',
  'bsd-3-clause': 'BSD-3-Clause',
  'gpl-2.0-only': 'GPL-2.0-only',
  'gpl-3.0-only': 'GPL-3.0-only',
  'lgpl-2.1-only': 'LGPL-2.1-only',
  'lgpl-3.0-only': 'LGPL-3.0-only',
  'agpl-3.0-only': 'AGPL-3.0-only',
  'sspl-1.0': 'SSPL-1.0',
  'eupl-1.1': 'EUPL-1.1',
  'eupl-1.2': 'EUPL-1.2',
};

/**
 * Normalize a license string to its canonical SPDX identifier.
 * Returns 'UNKNOWN' if the license cannot be identified.
 */
export function normalizeSpdxId(raw: string | null | undefined): string {
  if (!raw || raw.trim() === '') return 'UNKNOWN';

  const trimmed = raw.trim();

  // Direct match in DB
  if (DB_BY_SPDX.has(trimmed.toLowerCase())) {
    return DB_BY_SPDX.get(trimmed.toLowerCase())!.spdx_id;
  }

  // Check aliases
  const alias = SPDX_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;

  // Handle SPDX OR expressions — return as-is for further processing
  if (trimmed.includes(' OR ') || trimmed.includes(' or ')) {
    return trimmed;
  }

  // Strip parentheses
  const stripped = trimmed.replace(/^\(|\)$/g, '');
  const strippedAlias = SPDX_ALIASES[stripped.toLowerCase()];
  if (strippedAlias) return strippedAlias;
  if (DB_BY_SPDX.has(stripped.toLowerCase())) {
    return DB_BY_SPDX.get(stripped.toLowerCase())!.spdx_id;
  }

  // If it looks like an SPDX ID (contains letters and hyphens), pass through
  if (/^[A-Za-z0-9][A-Za-z0-9.\-+]+$/.test(trimmed)) {
    return trimmed;
  }

  return 'CUSTOM';
}

/**
 * Identify a license from its full text content using fingerprint matching.
 * Returns the SPDX ID or 'UNKNOWN' if no match.
 */
export function identifyLicenseFromText(text: string): string {
  if (!text || text.trim().length === 0) return 'UNKNOWN';

  const upper = text.toUpperCase();

  // BSD-3 must be checked before BSD-2 (BSD-3 is BSD-2 + extra clause)
  // AGPL must be checked before GPL (AGPL contains "GNU...General Public License")
  // LGPL must be checked before GPL
  const ordered: LicenseInfo[] = [
    ...LICENSE_DB.filter(l => l.spdx_id === 'AGPL-3.0-only'),
    ...LICENSE_DB.filter(l => l.spdx_id.startsWith('LGPL')),
    ...LICENSE_DB.filter(l => l.spdx_id === 'BSD-3-Clause'),
    ...LICENSE_DB.filter(l => l.spdx_id === 'BSD-2-Clause'),
    ...LICENSE_DB.filter(l =>
      !l.spdx_id.startsWith('AGPL') &&
      !l.spdx_id.startsWith('LGPL') &&
      !l.spdx_id.startsWith('BSD'),
    ),
  ];

  for (const lic of ordered) {
    const allMatch = lic.key_phrases.every(phrase =>
      upper.includes(phrase.toUpperCase()),
    );
    if (allMatch) return lic.spdx_id;
  }

  return 'UNKNOWN';
}

/**
 * Get license info by SPDX ID. Returns undefined if unknown.
 */
export function getLicenseInfo(spdxId: string): LicenseInfo | undefined {
  return DB_BY_SPDX.get(spdxId.toLowerCase());
}

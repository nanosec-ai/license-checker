export interface SpdxLicenseEntry {
  id: string;
  name: string;
  is_osi_approved: boolean;
  is_copyleft: boolean;
  is_permissive: boolean;
  is_deprecated: boolean;
}

/**
 * Comprehensive SPDX license list with classification metadata.
 * Includes all commonly-encountered licenses in npm/PyPI ecosystems.
 */
export const SPDX_LICENSES: SpdxLicenseEntry[] = [
  { id: 'MIT', name: 'MIT License', is_osi_approved: true, is_copyleft: false, is_permissive: true, is_deprecated: false },
  { id: 'Apache-2.0', name: 'Apache License 2.0', is_osi_approved: true, is_copyleft: false, is_permissive: true, is_deprecated: false },
  { id: 'BSD-2-Clause', name: 'BSD 2-Clause "Simplified" License', is_osi_approved: true, is_copyleft: false, is_permissive: true, is_deprecated: false },
  { id: 'BSD-3-Clause', name: 'BSD 3-Clause "New" or "Revised" License', is_osi_approved: true, is_copyleft: false, is_permissive: true, is_deprecated: false },
  { id: 'ISC', name: 'ISC License', is_osi_approved: true, is_copyleft: false, is_permissive: true, is_deprecated: false },
  { id: 'GPL-2.0-only', name: 'GNU General Public License v2.0 only', is_osi_approved: true, is_copyleft: true, is_permissive: false, is_deprecated: false },
  { id: 'GPL-2.0-or-later', name: 'GNU General Public License v2.0 or later', is_osi_approved: true, is_copyleft: true, is_permissive: false, is_deprecated: false },
  { id: 'GPL-3.0-only', name: 'GNU General Public License v3.0 only', is_osi_approved: true, is_copyleft: true, is_permissive: false, is_deprecated: false },
  { id: 'GPL-3.0-or-later', name: 'GNU General Public License v3.0 or later', is_osi_approved: true, is_copyleft: true, is_permissive: false, is_deprecated: false },
  { id: 'LGPL-2.1-only', name: 'GNU Lesser General Public License v2.1 only', is_osi_approved: true, is_copyleft: true, is_permissive: false, is_deprecated: false },
  { id: 'LGPL-2.1-or-later', name: 'GNU Lesser General Public License v2.1 or later', is_osi_approved: true, is_copyleft: true, is_permissive: false, is_deprecated: false },
  { id: 'LGPL-3.0-only', name: 'GNU Lesser General Public License v3.0 only', is_osi_approved: true, is_copyleft: true, is_permissive: false, is_deprecated: false },
  { id: 'LGPL-3.0-or-later', name: 'GNU Lesser General Public License v3.0 or later', is_osi_approved: true, is_copyleft: true, is_permissive: false, is_deprecated: false },
  { id: 'AGPL-3.0-only', name: 'GNU Affero General Public License v3.0', is_osi_approved: true, is_copyleft: true, is_permissive: false, is_deprecated: false },
  { id: 'AGPL-3.0-or-later', name: 'GNU Affero General Public License v3.0 or later', is_osi_approved: true, is_copyleft: true, is_permissive: false, is_deprecated: false },
  { id: 'MPL-2.0', name: 'Mozilla Public License 2.0', is_osi_approved: true, is_copyleft: true, is_permissive: false, is_deprecated: false },
  { id: 'Unlicense', name: 'The Unlicense', is_osi_approved: true, is_copyleft: false, is_permissive: true, is_deprecated: false },
  { id: 'CC0-1.0', name: 'Creative Commons Zero v1.0 Universal', is_osi_approved: false, is_copyleft: false, is_permissive: true, is_deprecated: false },
  { id: 'WTFPL', name: 'Do What The F*ck You Want To Public License', is_osi_approved: false, is_copyleft: false, is_permissive: true, is_deprecated: false },
  { id: 'Artistic-2.0', name: 'Artistic License 2.0', is_osi_approved: true, is_copyleft: false, is_permissive: true, is_deprecated: false },
  { id: 'Zlib', name: 'zlib License', is_osi_approved: true, is_copyleft: false, is_permissive: true, is_deprecated: false },
  { id: '0BSD', name: 'BSD Zero Clause License', is_osi_approved: true, is_copyleft: false, is_permissive: true, is_deprecated: false },
  { id: 'BlueOak-1.0.0', name: 'Blue Oak Model License 1.0.0', is_osi_approved: false, is_copyleft: false, is_permissive: true, is_deprecated: false },
  { id: 'SSPL-1.0', name: 'Server Side Public License v1', is_osi_approved: false, is_copyleft: true, is_permissive: false, is_deprecated: false },
  { id: 'EUPL-1.1', name: 'European Union Public License 1.1', is_osi_approved: true, is_copyleft: true, is_permissive: false, is_deprecated: false },
  { id: 'EUPL-1.2', name: 'European Union Public License 1.2', is_osi_approved: true, is_copyleft: true, is_permissive: false, is_deprecated: false },
  { id: 'BSL-1.0', name: 'Boost Software License 1.0', is_osi_approved: true, is_copyleft: false, is_permissive: true, is_deprecated: false },
  { id: 'PSF-2.0', name: 'Python Software Foundation License 2.0', is_osi_approved: false, is_copyleft: false, is_permissive: true, is_deprecated: false },
  { id: 'CPAL-1.0', name: 'Common Public Attribution License 1.0', is_osi_approved: true, is_copyleft: true, is_permissive: false, is_deprecated: false },
  { id: 'EPL-1.0', name: 'Eclipse Public License 1.0', is_osi_approved: true, is_copyleft: true, is_permissive: false, is_deprecated: false },
  { id: 'EPL-2.0', name: 'Eclipse Public License 2.0', is_osi_approved: true, is_copyleft: true, is_permissive: false, is_deprecated: false },
];

const SPDX_BY_ID = new Map<string, SpdxLicenseEntry>();
for (const lic of SPDX_LICENSES) {
  SPDX_BY_ID.set(lic.id.toLowerCase(), lic);
}

export function getSpdxLicense(id: string): SpdxLicenseEntry | undefined {
  return SPDX_BY_ID.get(id.toLowerCase());
}

export function isCopyleft(id: string): boolean {
  const lic = SPDX_BY_ID.get(id.toLowerCase());
  return lic?.is_copyleft ?? false;
}

export function isPermissive(id: string): boolean {
  const lic = SPDX_BY_ID.get(id.toLowerCase());
  return lic?.is_permissive ?? false;
}

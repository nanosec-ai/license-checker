import { randomUUID } from 'node:crypto';
import type { ResolvedDep } from '../types/index.js';

export interface SpdxOptions {
  project_name: string;
  project_version: string | null;
  deps: ResolvedDep[];
  licenseMap: Record<string, number>;
}

export function generateSpdx(opts: SpdxOptions): Record<string, unknown> {
  const { project_name, project_version, deps } = opts;
  const docNamespace = `https://spdx.org/spdxdocs/${project_name}-${randomUUID()}`;

  const packages = deps.map(dep => {
    const license = dep.license_declared ?? 'NOASSERTION';
    return {
      SPDXID: `SPDXRef-Package-${sanitizeRef(dep.name)}-${sanitizeRef(dep.version)}`,
      name: dep.name,
      versionInfo: dep.version,
      downloadLocation: dep.purl ? `https://registry.npmjs.org/${dep.name}/-/${dep.name}-${dep.version}.tgz` : 'NOASSERTION',
      licenseConcluded: license === 'UNKNOWN' ? 'NOASSERTION' : license,
      licenseDeclared: license === 'UNKNOWN' ? 'NOASSERTION' : license,
      copyrightText: 'NOASSERTION',
      externalRefs: dep.purl ? [{
        referenceCategory: 'PACKAGE-MANAGER',
        referenceType: 'purl',
        referenceLocator: dep.purl,
      }] : [],
      filesAnalyzed: false,
    };
  });

  const rootRef = `SPDXRef-Package-${sanitizeRef(project_name)}`;

  // Build relationships
  const relationships = [
    {
      spdxElementId: 'SPDXRef-DOCUMENT',
      relatedSpdxElement: rootRef,
      relationshipType: 'DESCRIBES',
    },
  ];

  for (const dep of deps) {
    const depRef = `SPDXRef-Package-${sanitizeRef(dep.name)}-${sanitizeRef(dep.version)}`;
    if (dep.is_direct) {
      relationships.push({
        spdxElementId: rootRef,
        relatedSpdxElement: depRef,
        relationshipType: 'DEPENDS_ON',
      });
    }

    for (const childName of dep.dependencies) {
      const child = deps.find(d => d.name === childName);
      if (child) {
        const childRef = `SPDXRef-Package-${sanitizeRef(child.name)}-${sanitizeRef(child.version)}`;
        relationships.push({
          spdxElementId: depRef,
          relatedSpdxElement: childRef,
          relationshipType: 'DEPENDS_ON',
        });
      }
    }
  }

  return {
    spdxVersion: 'SPDX-2.3',
    dataLicense: 'CC0-1.0',
    SPDXID: 'SPDXRef-DOCUMENT',
    name: project_name,
    documentNamespace: docNamespace,
    creationInfo: {
      created: new Date().toISOString(),
      creators: ['Tool: LicenseChecker-1.0.0'],
      licenseListVersion: '3.22',
    },
    packages: [
      {
        SPDXID: rootRef,
        name: project_name,
        versionInfo: project_version ?? '0.0.0',
        downloadLocation: 'NOASSERTION',
        licenseConcluded: 'NOASSERTION',
        licenseDeclared: 'NOASSERTION',
        copyrightText: 'NOASSERTION',
        filesAnalyzed: false,
      },
      ...packages,
    ],
    relationships,
  };
}

function sanitizeRef(str: string): string {
  return str.replace(/[^a-zA-Z0-9.-]/g, '-');
}

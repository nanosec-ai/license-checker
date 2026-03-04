import { randomUUID } from 'node:crypto';
import type { ResolvedDep } from '../types/index.js';

export interface CycloneDxOptions {
  project_name: string;
  project_version: string | null;
  deps: ResolvedDep[];
  licenseMap: Record<string, number>;
}

export function generateCycloneDx(opts: CycloneDxOptions): Record<string, unknown> {
  const { project_name, project_version, deps, licenseMap } = opts;

  const components = deps.map(dep => {
    const license = dep.license_declared ?? 'NOASSERTION';
    const component: Record<string, unknown> = {
      type: 'library',
      name: dep.name,
      version: dep.version,
      purl: dep.purl,
      licenses: license !== 'UNKNOWN' && license !== 'NOASSERTION'
        ? [{ license: { id: license } }]
        : [{ license: { name: license } }],
      scope: dep.scope === 'dev' ? 'optional' : dep.scope,
    };

    if (dep.integrity) {
      // Parse integrity hash (e.g., "sha512-abc123...")
      const match = dep.integrity.match(/^(sha\d+)-(.+)$/);
      if (match) {
        const alg = match[1].toUpperCase().replace('SHA', 'SHA-');
        component.hashes = [{ alg, content: match[2] }];
      }
    }

    return component;
  });

  const dependencies = deps.map(dep => ({
    ref: dep.purl,
    dependsOn: dep.dependencies
      .map(childName => {
        const child = deps.find(d => d.name === childName);
        return child?.purl;
      })
      .filter(Boolean),
  }));

  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [{
        vendor: 'Nanosecond AI',
        name: 'LicenseChecker',
        version: '1.0.0',
      }],
      component: {
        type: 'application',
        name: project_name,
        version: project_version ?? '0.0.0',
      },
    },
    components,
    dependencies,
  };
}

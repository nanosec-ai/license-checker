export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateCycloneDx(sbom: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required top-level fields
  if (sbom.bomFormat !== 'CycloneDX') errors.push('Missing or invalid bomFormat');
  if (sbom.specVersion !== '1.5') errors.push('Missing or invalid specVersion');
  if (!sbom.serialNumber) errors.push('Missing serialNumber');
  if (sbom.version !== 1) warnings.push('version should be 1');

  // Metadata
  const metadata = sbom.metadata as Record<string, unknown> | undefined;
  if (!metadata) {
    errors.push('Missing metadata');
  } else {
    if (!metadata.timestamp) errors.push('Missing metadata.timestamp');
    if (!metadata.tools) errors.push('Missing metadata.tools');
  }

  // Components
  const components = sbom.components as Record<string, unknown>[] | undefined;
  if (!components) {
    errors.push('Missing components');
  } else {
    for (let i = 0; i < components.length; i++) {
      const c = components[i];
      if (!c.name) errors.push(`Component ${i}: missing name`);
      if (!c.version) errors.push(`Component ${i}: missing version`);
      if (!c.purl) errors.push(`Component ${i}: missing purl`);
      if (!c.licenses || !Array.isArray(c.licenses) || c.licenses.length === 0) {
        errors.push(`Component ${i} (${c.name}): missing licenses`);
      }
    }
  }

  // Dependencies
  const dependencies = sbom.dependencies as Record<string, unknown>[] | undefined;
  if (!dependencies) {
    warnings.push('Missing dependencies section');
  } else {
    const componentPurls = new Set(
      (components ?? []).map(c => c.purl as string).filter(Boolean),
    );
    for (const dep of dependencies) {
      const ref = dep.ref as string;
      if (!componentPurls.has(ref)) {
        warnings.push(`Dependency ref ${ref} not found in components`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateSpdx(sbom: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (sbom.spdxVersion !== 'SPDX-2.3') errors.push('Missing or invalid spdxVersion');
  if (sbom.dataLicense !== 'CC0-1.0') errors.push('Missing or invalid dataLicense');
  if (sbom.SPDXID !== 'SPDXRef-DOCUMENT') errors.push('Missing or invalid SPDXID');
  if (!sbom.name) errors.push('Missing name');
  if (!sbom.documentNamespace) errors.push('Missing documentNamespace');

  const creationInfo = sbom.creationInfo as Record<string, unknown> | undefined;
  if (!creationInfo) {
    errors.push('Missing creationInfo');
  } else {
    if (!creationInfo.created) errors.push('Missing creationInfo.created');
    if (!creationInfo.creators) errors.push('Missing creationInfo.creators');
  }

  const packages = sbom.packages as Record<string, unknown>[] | undefined;
  if (!packages) {
    errors.push('Missing packages');
  } else {
    const ids = new Set<string>();
    for (let i = 0; i < packages.length; i++) {
      const p = packages[i];
      if (!p.SPDXID) errors.push(`Package ${i}: missing SPDXID`);
      if (!p.name) errors.push(`Package ${i}: missing name`);
      if (!p.versionInfo) errors.push(`Package ${i}: missing versionInfo`);
      if (p.SPDXID) ids.add(p.SPDXID as string);
    }

    // Validate relationships reference valid IDs
    const relationships = sbom.relationships as Record<string, unknown>[] | undefined;
    if (relationships) {
      for (const rel of relationships) {
        const elem = rel.spdxElementId as string;
        const related = rel.relatedSpdxElement as string;
        if (elem !== 'SPDXRef-DOCUMENT' && !ids.has(elem)) {
          warnings.push(`Relationship references unknown element: ${elem}`);
        }
        if (!ids.has(related)) {
          warnings.push(`Relationship references unknown element: ${related}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

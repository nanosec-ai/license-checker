// ---- Enums & Literals ----

export type EngineId = 'resolver' | 'identifier' | 'compatibility' | 'policy' | 'attribution';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type RiskGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type Ecosystem = 'npm' | 'python';
export type DistributionModel = 'source' | 'binary' | 'saas' | 'unknown';
export type LicenseClassification = 'permissive' | 'copyleft' | 'weak-copyleft' | 'public-domain' | 'unknown' | 'custom';

// ---- Resolved Dependency ----

export interface ResolvedDep {
  name: string;
  version: string;
  license_declared: string | null;
  license_file_content: string | null;
  purl: string;
  scope: 'required' | 'optional' | 'dev';
  integrity: string | null;
  is_direct: boolean;
  introduced_by: string[];  // dependency path from root
  dependencies: string[];   // child package names
}

// ---- Normalized Finding ----

export interface Finding {
  engine: EngineId;
  severity: Severity;
  package_name: string;
  package_version: string | null;
  finding_id: string;
  title: string;
  detail: string;
  license_detected: string | null;
  introduced_by: string[];
  conflict_type: string | null;
  remediation: string | null;
  references: string[];
}

// ---- Engine Result ----

export interface EngineResult {
  engine: EngineId;
  findings: Finding[];
  duration_ms: number;
  error?: string;
  resolved_deps?: ResolvedDep[];
  license_map?: Record<string, number>;
  attribution_notices?: AttributionNotice[];
  dep_counts?: {
    direct: number;
    transitive: number;
    total: number;
  };
}

// ---- Scan Context ----

export interface ScanContext {
  workDir: string;
  ecosystem: Ecosystem;
  manifest_content: string;
  lockfile_content?: string;
  project_name: string;
  project_version: string | null;
  project_license: string;
  distribution_model: DistributionModel;
  include_dev: boolean;
  policy?: PolicyConfig;
}

// ---- Policy Config ----

export interface PolicyConfig {
  allowed?: string[];
  denied?: string[];
}

// ---- Attribution Notice ----

export interface AttributionNotice {
  package_name: string;
  package_version: string;
  license: string;
  copyright_holders: string[];
  license_text: string;
  notice_text: string | null;
}

// ---- License Audit Report ----

export interface LicenseAuditReport {
  audit_id: string;
  timestamp: string;
  audit_target: string;
  ecosystem: Ecosystem;
  scan_duration_ms: number;

  project_name: string;
  project_version: string | null;
  project_license: string;
  distribution_model: DistributionModel;

  total_dependencies: number;
  direct_dependencies: number;
  transitive_dependencies: number;

  license_summary: {
    total_licenses_detected: number;
    license_distribution: Record<string, number>;
    unknown_count: number;
    custom_count: number;
    copyleft_count: number;
    permissive_count: number;
  };

  severity_counts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };

  compliance_score: number;
  risk_grade: RiskGrade;

  findings: Finding[];

  policy_result: {
    policy_applied: boolean;
    denied_violations: number;
    allowed_violations: number;
    pass: boolean;
  };

  cra_readiness: CraReadiness;

  top_remediations: LicenseRemediation[];
}

// ---- CRA Readiness ----

export interface CraReadiness {
  sbom_generated: boolean;
  all_licenses_identified: boolean;
  no_unknown_licenses: boolean;
  vulnerability_reporting_ready: boolean;
  purls_present: boolean;
  sbom_valid: boolean;
  readiness_score: number;
  gaps: string[];
}

// ---- License Remediation ----

export interface LicenseRemediation {
  package_name: string;
  current_license: string;
  issue: string;
  action: string;
  impact: string;
}

// ---- SBOM Output ----

export interface SbomOutput {
  format: 'cyclonedx' | 'spdx';
  content: Record<string, unknown>;
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
}

// ---- Compatibility Result ----

export interface CompatibilityResult {
  compatible: boolean;
  conflicts: CompatibilityConflict[];
  summary: string;
}

export interface CompatibilityConflict {
  dependency: string;
  dependency_license: string;
  project_license: string;
  conflict_type: 'COPYLEFT_IN_PROPRIETARY' | 'INCOMPATIBLE_COPYLEFT' | 'AGPL_NETWORK' | 'PATENT_CLAUSE' | 'UNKNOWN_LICENSE' | 'CUSTOM_LICENSE';
  introduced_by: string[];
  severity: Severity;
  explanation: string;
  remediation: string;
}

// ---- License Info (from database) ----

export interface LicenseInfo {
  spdx_id: string;
  name: string;
  is_osi_approved: boolean;
  classification: LicenseClassification;
  key_phrases: string[];
  requires_attribution: boolean;
  copyleft_type: 'none' | 'weak' | 'strong' | 'network';
}

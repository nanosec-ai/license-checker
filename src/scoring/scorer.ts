import type { Finding, RiskGrade, Severity } from '../types/index.js';

const DEDUCTIONS: Record<Severity, number> = {
  CRITICAL: 20,
  HIGH: 10,
  MEDIUM: 4,
  LOW: 1,
  INFO: 0,
};

const CAPS: Record<Severity, number> = {
  CRITICAL: 60,
  HIGH: 40,
  MEDIUM: 20,
  LOW: 10,
  INFO: 0,
};

const SEVERITY_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

export function calculateScore(findings: Finding[]): { compliance_score: number; risk_grade: RiskGrade } {
  const totals: Record<Severity, number> = {
    CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0,
  };

  for (const f of findings) {
    let deduction = DEDUCTIONS[f.severity];

    // Copyleft contamination chain multiplier: 1.25x for transitive deps
    if (f.severity === 'CRITICAL' && f.introduced_by.length > 1) {
      deduction = Math.ceil(deduction * 1.25);
    }

    // Policy violation overlay: minimum -15 per denied violation
    if (f.finding_id.startsWith('POL-DENIED')) {
      deduction = Math.max(deduction, 15);
    }

    totals[f.severity] = Math.min(
      totals[f.severity] + deduction,
      CAPS[f.severity],
    );
  }

  const totalDeduction = SEVERITY_ORDER.reduce((sum, s) => sum + totals[s], 0);
  const compliance_score = Math.max(0, Math.min(100, 100 - totalDeduction));

  return { compliance_score, risk_grade: scoreToGrade(compliance_score) };
}

function scoreToGrade(score: number): RiskGrade {
  if (score >= 90) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 25) return 'D';
  return 'F';
}

export function countSeverities(findings: Finding[]) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) {
    switch (f.severity) {
      case 'CRITICAL': counts.critical++; break;
      case 'HIGH': counts.high++; break;
      case 'MEDIUM': counts.medium++; break;
      case 'LOW': counts.low++; break;
      case 'INFO': counts.info++; break;
    }
  }
  return counts;
}

export function sortFindings(findings: Finding[]): Finding[] {
  const order: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
  return [...findings].sort((a, b) => {
    const sev = order[a.severity] - order[b.severity];
    if (sev !== 0) return sev;
    return a.package_name.localeCompare(b.package_name);
  });
}

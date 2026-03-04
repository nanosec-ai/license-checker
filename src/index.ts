#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { handleCheckLicenses } from './tools/check-licenses.js';
import { handleGenerateSbom } from './tools/generate-sbom.js';
import { handleCheckCompat } from './tools/check-compat.js';

const server = new McpServer({
  name: 'license-checker',
  version: '1.0.0',
});

// ---- Tool 1: check_licenses ----
server.registerTool(
  'check_licenses',
  {
    title: 'Check License Compliance',
    description:
      'Audit a project\'s dependency tree for license compliance issues. ' +
      'Detects copyleft contamination, unknown licenses, policy violations, ' +
      'and generates a compliance score with CRA readiness assessment.',
    inputSchema: {
      package_json: z.string().optional()
        .describe('Contents of package.json as a string. Provide either this or requirements_txt.'),
      requirements_txt: z.string().optional()
        .describe('Contents of requirements.txt as a string. Provide either this or package_json.'),
      project_license: z.string().optional()
        .describe('SPDX license identifier for your project (e.g., "MIT", "Apache-2.0"). Auto-detected from package.json if not provided.'),
      distribution_model: z.enum(['source', 'binary', 'saas', 'unknown']).optional()
        .describe('How your project is distributed. Affects copyleft obligation analysis. Default: "unknown".'),
      include_dev: z.boolean().default(true)
        .describe('Whether to include devDependencies. Default: true.'),
      policy: z.object({
        allowed: z.array(z.string()).optional()
          .describe('Allowlist of SPDX license IDs. Any dep not on this list is flagged.'),
        denied: z.array(z.string()).optional()
          .describe('Denylist of SPDX license IDs. Any dep on this list is flagged.'),
      }).optional()
        .describe('Custom license policy. If not provided, a default deny list is applied.'),
    },
  },
  async (input) => {
    if (!input.package_json && !input.requirements_txt) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Provide either package_json or requirements_txt' }) }] };
    }
    try {
      const report = await handleCheckLicenses(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(report, null, 2) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }] };
    }
  },
);

// ---- Tool 2: generate_sbom ----
server.registerTool(
  'generate_sbom',
  {
    title: 'Generate SBOM',
    description:
      'Generate a Software Bill of Materials (SBOM) in CycloneDX 1.5 or SPDX 2.3 format. ' +
      'Includes license information, purl identifiers, and dependency relationships. ' +
      'Essential for EU CRA compliance.',
    inputSchema: {
      package_json: z.string().optional()
        .describe('Contents of package.json as a string. Provide either this or requirements_txt.'),
      requirements_txt: z.string().optional()
        .describe('Contents of requirements.txt as a string. Provide either this or package_json.'),
      format: z.enum(['cyclonedx', 'spdx']).default('cyclonedx')
        .describe('SBOM format. Default: "cyclonedx".'),
      include_dev: z.boolean().default(false)
        .describe('Whether to include devDependencies. Default: false.'),
    },
  },
  async (input) => {
    if (!input.package_json && !input.requirements_txt) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Provide either package_json or requirements_txt' }) }] };
    }
    try {
      const sbom = await handleGenerateSbom(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(sbom, null, 2) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }] };
    }
  },
);

// ---- Tool 3: check_compatibility ----
server.registerTool(
  'check_compatibility',
  {
    title: 'Check License Compatibility',
    description:
      'Check if all dependency licenses are compatible with your project\'s license. ' +
      'Evaluates copyleft obligations, patent clause conflicts, and distribution model impact. ' +
      'Accepts either a package manifest (package_json/requirements_txt) or raw SPDX license identifiers (dependency_licenses).',
    inputSchema: {
      package_json: z.string().optional()
        .describe('Contents of package.json as a string. Provide this, requirements_txt, or dependency_licenses.'),
      requirements_txt: z.string().optional()
        .describe('Contents of requirements.txt as a string. Provide this, package_json, or dependency_licenses.'),
      dependency_licenses: z.array(z.string()).optional()
        .describe('Array of SPDX license identifiers to check directly (e.g., ["AGPL-3.0-only", "MIT"]). Bypasses npm/pip resolution.'),
      project_license: z.string()
        .describe('Your project\'s SPDX license identifier (e.g., "MIT", "Apache-2.0", "proprietary").'),
      distribution_model: z.enum(['source', 'binary', 'saas', 'unknown']).default('binary')
        .describe('How your project is distributed. Default: "binary".'),
      distribution: z.enum(['source', 'binary', 'saas', 'unknown']).optional()
        .describe('Alias for distribution_model.'),
      include_dev: z.boolean().default(false)
        .describe('Whether to include devDependencies. Default: false.'),
    },
  },
  async (input) => {
    if (!input.package_json && !input.requirements_txt && (!input.dependency_licenses || input.dependency_licenses.length === 0)) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Provide either package_json, requirements_txt, or dependency_licenses' }) }] };
    }
    try {
      const result = await handleCheckCompat(input);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }] };
    }
  },
);

// ---- Connect ----
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('license-checker MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

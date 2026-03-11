#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import express from 'express';
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

// ---- Tool schemas for /capabilities ----
const TOOL_SCHEMAS = [
  {
    name: 'check_licenses',
    title: 'Check License Compliance',
    description: 'Audit a project\'s dependency tree for license compliance issues. Detects copyleft contamination, unknown licenses, policy violations, and generates a compliance score.',
    inputSchema: {
      type: 'object',
      properties: {
        package_json: { type: 'string', description: 'Contents of package.json' },
        requirements_txt: { type: 'string', description: 'Contents of requirements.txt' },
        project_license: { type: 'string', description: 'SPDX license identifier for your project' },
        distribution_model: { type: 'string', enum: ['source', 'binary', 'saas', 'unknown'], description: 'Distribution model' },
        include_dev: { type: 'boolean', default: true, description: 'Include devDependencies' },
        policy: {
          type: 'object',
          properties: {
            allowed: { type: 'array', items: { type: 'string' }, description: 'Allowlist of SPDX license IDs' },
            denied: { type: 'array', items: { type: 'string' }, description: 'Denylist of SPDX license IDs' },
          },
          description: 'Custom license policy',
        },
      },
    },
  },
  {
    name: 'generate_sbom',
    title: 'Generate SBOM',
    description: 'Generate a Software Bill of Materials (SBOM) in CycloneDX 1.5 or SPDX 2.3 format.',
    inputSchema: {
      type: 'object',
      properties: {
        package_json: { type: 'string', description: 'Contents of package.json' },
        requirements_txt: { type: 'string', description: 'Contents of requirements.txt' },
        format: { type: 'string', enum: ['cyclonedx', 'spdx'], default: 'cyclonedx', description: 'SBOM format' },
        include_dev: { type: 'boolean', default: false, description: 'Include devDependencies' },
      },
    },
  },
  {
    name: 'check_compatibility',
    title: 'Check License Compatibility',
    description: 'Check if all dependency licenses are compatible with your project\'s license.',
    inputSchema: {
      type: 'object',
      properties: {
        package_json: { type: 'string', description: 'Contents of package.json' },
        requirements_txt: { type: 'string', description: 'Contents of requirements.txt' },
        dependency_licenses: { type: 'array', items: { type: 'string' }, description: 'Array of SPDX license identifiers' },
        project_license: { type: 'string', description: 'Your project\'s SPDX license identifier' },
        distribution_model: { type: 'string', enum: ['source', 'binary', 'saas', 'unknown'], default: 'binary', description: 'Distribution model' },
        include_dev: { type: 'boolean', default: false, description: 'Include devDependencies' },
      },
      required: ['project_license'],
    },
  },
];

// ---- Audit dispatch handler map ----
const AUDIT_HANDLERS: Record<string, (input: any) => Promise<any>> = {
  check_licenses: handleCheckLicenses,
  generate_sbom: handleGenerateSbom,
  check_compatibility: handleCheckCompat,
};

// ---- Rate limiter (max 10 concurrent audits) ----
const MAX_CONCURRENT = 10;
const AUDIT_TIMEOUT_MS = 120_000;
let activeAudits = 0;

// ---- Parse CLI args ----
const args = process.argv.slice(2);
const transportIdx = args.indexOf('--transport');
const transportMode = transportIdx !== -1 ? args[transportIdx + 1] : 'stdio';

// ---- Connect ----
async function main() {
  if (transportMode === 'http') {
    const app = express();
    app.use(express.json());

    // MCP streamable-http transport
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    // Route MCP requests
    app.all('/mcp', (req, res) => {
      transport.handleRequest(req, res, req.body);
    });

    // Health check
    app.get('/health', (_req, res) => {
      res.json({ status: 'ok', agent: 'license-checker', version: '1.0.0' });
    });

    // Capabilities
    app.get('/capabilities', (_req, res) => {
      res.json({ tools: TOOL_SCHEMAS });
    });

    // Direct audit dispatch endpoint
    app.post('/audit', async (req, res) => {
      const { tool, input, dispatch_id } = req.body;

      if (!tool || !input || !dispatch_id) {
        res.status(400).json({
          dispatch_id: dispatch_id ?? null,
          status: 'error',
          report: null,
          error: { code: 'INVALID_REQUEST', message: 'Missing required fields: tool, input, dispatch_id' },
        });
        return;
      }

      const handler = AUDIT_HANDLERS[tool];
      if (!handler) {
        res.status(400).json({
          dispatch_id,
          status: 'error',
          report: null,
          error: { code: 'UNKNOWN_TOOL', message: `Unknown tool: ${tool}. Available: ${Object.keys(AUDIT_HANDLERS).join(', ')}` },
        });
        return;
      }

      // Rate limit check
      if (activeAudits >= MAX_CONCURRENT) {
        res.status(429).json({
          dispatch_id,
          status: 'error',
          report: null,
          error: { code: 'RATE_LIMITED', message: `Max ${MAX_CONCURRENT} concurrent audits. Try again shortly.` },
        });
        return;
      }

      activeAudits++;
      try {
        const result = await Promise.race([
          handler(input),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), AUDIT_TIMEOUT_MS),
          ),
        ]);

        res.json({
          dispatch_id,
          status: 'complete',
          report: result,
          error: null,
        });
      } catch (err: any) {
        const isTimeout = err?.message === 'TIMEOUT';
        res.status(isTimeout ? 504 : 500).json({
          dispatch_id,
          status: 'error',
          report: null,
          error: {
            code: isTimeout ? 'TIMEOUT' : 'AUDIT_FAILED',
            message: isTimeout
              ? `Audit exceeded ${AUDIT_TIMEOUT_MS / 1000}s timeout`
              : (err?.message ?? 'Unknown error'),
          },
        });
      } finally {
        activeAudits--;
      }
    });

    const httpServer = app.listen(3002, '0.0.0.0', () => {
      console.error('license-checker HTTP server listening on 0.0.0.0:3002');
    });

    await server.connect(transport);
    console.error('license-checker MCP transport connected');

    // Graceful shutdown
    const shutdown = () => {
      console.error('Shutting down...');
      httpServer.close(() => process.exit(0));
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } else {
    // stdio mode (default)
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('license-checker MCP server running on stdio');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

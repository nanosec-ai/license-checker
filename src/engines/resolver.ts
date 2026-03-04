import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { EngineResult, ResolvedDep, ScanContext } from '../types/index.js';

const execFileAsync = promisify(execFile);

const RESOLUTION_TIMEOUT = 60_000;

interface ResolverOpts {
  exec?: typeof execFileAsync;
  fetch?: typeof globalThis.fetch;
}

export async function runResolver(
  ctx: ScanContext,
  opts?: ResolverOpts,
): Promise<EngineResult> {
  const start = performance.now();

  try {
    const resolved = ctx.ecosystem === 'npm'
      ? await resolveNpm(ctx, opts)
      : await resolvePython(ctx, opts);

    const direct = resolved.filter(d => d.is_direct).length;
    const transitive = resolved.filter(d => !d.is_direct).length;

    return {
      engine: 'resolver',
      findings: [],
      duration_ms: performance.now() - start,
      resolved_deps: resolved,
      dep_counts: {
        direct,
        transitive,
        total: resolved.length,
      },
    };
  } catch (err) {
    return {
      engine: 'resolver',
      findings: [],
      duration_ms: performance.now() - start,
      error: err instanceof Error ? err.message : String(err),
      resolved_deps: [],
    };
  }
}

async function resolveNpm(
  ctx: ScanContext,
  opts?: ResolverOpts,
): Promise<ResolvedDep[]> {
  const exec = opts?.exec ?? execFileAsync;

  // Write manifest to temp dir
  const pkgPath = join(ctx.workDir, 'package.json');
  await writeFile(pkgPath, ctx.manifest_content, 'utf-8');

  if (ctx.lockfile_content) {
    await writeFile(join(ctx.workDir, 'package-lock.json'), ctx.lockfile_content, 'utf-8');
  }

  // Run npm install --package-lock-only --ignore-scripts
  await exec('npm', ['install', '--package-lock-only', '--ignore-scripts'], {
    cwd: ctx.workDir,
    timeout: RESOLUTION_TIMEOUT,
  });

  // Parse the generated package-lock.json
  const lockRaw = await readFile(join(ctx.workDir, 'package-lock.json'), 'utf-8');
  const lock = JSON.parse(lockRaw);
  const pkg = JSON.parse(ctx.manifest_content);
  const directDeps = new Set<string>([
    ...Object.keys(pkg.dependencies ?? {}),
    ...(ctx.include_dev ? Object.keys(pkg.devDependencies ?? {}) : []),
  ]);

  const resolved: ResolvedDep[] = [];
  const packages = lock.packages ?? {};

  for (const [pkgPath, info] of Object.entries(packages) as [string, Record<string, unknown>][]) {
    // Skip root
    if (pkgPath === '') continue;

    const name = extractPackageName(pkgPath);
    if (!name) continue;

    const version = info.version as string ?? '';
    const licenseDeclared = (info.license as string) ?? null;
    const integrity = (info.integrity as string) ?? null;
    const isDev = !!(info.dev);
    const isDirect = directDeps.has(name);

    // Build purl
    const purl = buildPurl('npm', name, version);

    // Determine scope
    const scope: ResolvedDep['scope'] = isDev ? 'dev' : (info.optional ? 'optional' : 'required');

    // Build dependency list
    const deps = Object.keys((info.dependencies ?? {}) as Record<string, unknown>);

    // Build introduced_by path
    const parts = pkgPath.replace('node_modules/', '').split('/node_modules/');
    const introduced_by = parts.length > 1 ? parts.slice(0, -1) : [name];

    if (!ctx.include_dev && isDev) continue;

    resolved.push({
      name,
      version,
      license_declared: licenseDeclared,
      license_file_content: null,
      purl,
      scope,
      integrity,
      is_direct: isDirect,
      introduced_by,
      dependencies: deps,
    });
  }

  return resolved;
}

async function resolvePython(
  ctx: ScanContext,
  opts?: ResolverOpts,
): Promise<ResolvedDep[]> {
  const fetchFn = opts?.fetch ?? globalThis.fetch;
  const lines = ctx.manifest_content
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && !l.startsWith('-'));

  const resolved: ResolvedDep[] = [];

  for (const line of lines) {
    // Parse requirement line: name[extras]>=version,<version
    const match = line.match(/^([a-zA-Z0-9_.-]+)(?:\[.*?\])?(?:\s*([><=!~]+)\s*([0-9a-zA-Z.*]+))?/);
    if (!match) continue;

    const name = match[1].toLowerCase().replace(/_/g, '-');
    let version = match[3] ?? 'latest';

    // Query PyPI for package info
    try {
      const resp = await fetchFn(`https://pypi.org/pypi/${name}/json`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (resp.ok) {
        const data = await resp.json() as {
          info: { version: string; license: string; classifiers: string[] };
        };
        if (version === 'latest') version = data.info.version;

        // Extract license from classifier or license field
        let licenseDeclared = data.info.license ?? null;
        if (!licenseDeclared || licenseDeclared === 'UNKNOWN') {
          const licClassifier = data.info.classifiers?.find(
            (c: string) => c.startsWith('License :: OSI Approved ::'),
          );
          if (licClassifier) {
            licenseDeclared = classifierToSpdx(licClassifier);
          }
        }

        resolved.push({
          name,
          version,
          license_declared: licenseDeclared,
          license_file_content: null,
          purl: buildPurl('pypi', name, version),
          scope: 'required',
          integrity: null,
          is_direct: true,
          introduced_by: [name],
          dependencies: [],
        });
      }
    } catch {
      // Still add with unknown license
      resolved.push({
        name,
        version,
        license_declared: null,
        license_file_content: null,
        purl: buildPurl('pypi', name, version),
        scope: 'required',
        integrity: null,
        is_direct: true,
        introduced_by: [name],
        dependencies: [],
      });
    }
  }

  return resolved;
}

function extractPackageName(pkgPath: string): string | null {
  // node_modules/foo or node_modules/@scope/foo
  const parts = pkgPath.split('node_modules/');
  const last = parts[parts.length - 1];
  if (!last) return null;
  return last;
}

function buildPurl(type: string, name: string, version: string): string {
  if (type === 'npm' && name.startsWith('@')) {
    const [scope, pkg] = name.split('/');
    return `pkg:npm/${scope}/${pkg}@${version}`;
  }
  return `pkg:${type}/${name}@${version}`;
}

function classifierToSpdx(classifier: string): string {
  const mapping: Record<string, string> = {
    'License :: OSI Approved :: MIT License': 'MIT',
    'License :: OSI Approved :: Apache Software License': 'Apache-2.0',
    'License :: OSI Approved :: BSD License': 'BSD-3-Clause',
    'License :: OSI Approved :: ISC License (ISCL)': 'ISC',
    'License :: OSI Approved :: GNU General Public License v2 (GPLv2)': 'GPL-2.0-only',
    'License :: OSI Approved :: GNU General Public License v3 (GPLv3)': 'GPL-3.0-only',
    'License :: OSI Approved :: GNU Lesser General Public License v2 (LGPLv2)': 'LGPL-2.1-only',
    'License :: OSI Approved :: GNU Lesser General Public License v3 (LGPLv3)': 'LGPL-3.0-only',
    'License :: OSI Approved :: GNU Affero General Public License v3': 'AGPL-3.0-only',
    'License :: OSI Approved :: Mozilla Public License 2.0 (MPL 2.0)': 'MPL-2.0',
    'License :: OSI Approved :: The Unlicense (Unlicense)': 'Unlicense',
    'License :: OSI Approved :: Python Software Foundation License': 'PSF-2.0',
    'License :: OSI Approved :: Artistic License': 'Artistic-2.0',
    'License :: OSI Approved :: zlib/libpng License': 'Zlib',
  };
  return mapping[classifier] ?? 'UNKNOWN';
}

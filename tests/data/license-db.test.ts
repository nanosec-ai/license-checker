import { describe, it, expect } from 'vitest';
import { normalizeSpdxId, identifyLicenseFromText, getLicenseInfo } from '../../src/data/license-db.js';

describe('normalizeSpdxId', () => {
  it('normalizes known SPDX IDs', () => {
    expect(normalizeSpdxId('MIT')).toBe('MIT');
    expect(normalizeSpdxId('mit')).toBe('MIT');
    expect(normalizeSpdxId('Apache-2.0')).toBe('Apache-2.0');
    expect(normalizeSpdxId('ISC')).toBe('ISC');
  });

  it('normalizes aliases', () => {
    expect(normalizeSpdxId('apache 2.0')).toBe('Apache-2.0');
    expect(normalizeSpdxId('gpl3')).toBe('GPL-3.0-only');
    expect(normalizeSpdxId('gplv2')).toBe('GPL-2.0-only');
    expect(normalizeSpdxId('(MIT)')).toBe('MIT');
    expect(normalizeSpdxId('lgpl3')).toBe('LGPL-3.0-only');
  });

  it('returns UNKNOWN for empty/null', () => {
    expect(normalizeSpdxId(null)).toBe('UNKNOWN');
    expect(normalizeSpdxId(undefined)).toBe('UNKNOWN');
    expect(normalizeSpdxId('')).toBe('UNKNOWN');
  });

  it('preserves OR expressions', () => {
    expect(normalizeSpdxId('MIT OR GPL-3.0-only')).toContain('OR');
  });

  it('returns CUSTOM for unrecognized non-SPDX strings', () => {
    expect(normalizeSpdxId('Some Company Proprietary License v2')).toBe('CUSTOM');
  });
});

describe('identifyLicenseFromText', () => {
  it('identifies MIT license', () => {
    expect(identifyLicenseFromText('Permission is hereby granted, free of charge, to any person')).toBe('MIT');
  });

  it('identifies Apache-2.0 license', () => {
    expect(identifyLicenseFromText('Apache License, Version 2.0\nLicensed under the Apache License')).toBe('Apache-2.0');
  });

  it('identifies ISC license', () => {
    expect(identifyLicenseFromText('Permission to use, copy, modify, and/or distribute this software')).toBe('ISC');
  });

  it('identifies GPL-3.0', () => {
    expect(identifyLicenseFromText('GNU General Public License\nVersion 3, 29 June 2007')).toBe('GPL-3.0-only');
  });

  it('identifies AGPL-3.0 (before GPL)', () => {
    expect(identifyLicenseFromText('GNU Affero General Public License\nVersion 3')).toBe('AGPL-3.0-only');
  });

  it('identifies BSD-3-Clause (not BSD-2)', () => {
    expect(identifyLicenseFromText('Redistribution and use in source and binary forms\nNeither the name')).toBe('BSD-3-Clause');
  });

  it('returns UNKNOWN for unidentifiable text', () => {
    expect(identifyLicenseFromText('Lorem ipsum dolor sit amet')).toBe('UNKNOWN');
    expect(identifyLicenseFromText('')).toBe('UNKNOWN');
  });
});

describe('getLicenseInfo', () => {
  it('returns info for known licenses', () => {
    const mit = getLicenseInfo('MIT');
    expect(mit).toBeDefined();
    expect(mit!.classification).toBe('permissive');
    expect(mit!.copyleft_type).toBe('none');
  });

  it('returns undefined for unknown licenses', () => {
    expect(getLicenseInfo('NONEXISTENT')).toBeUndefined();
  });

  it('identifies copyleft licenses', () => {
    const gpl = getLicenseInfo('GPL-3.0-only');
    expect(gpl!.classification).toBe('copyleft');
    expect(gpl!.copyleft_type).toBe('strong');

    const agpl = getLicenseInfo('AGPL-3.0-only');
    expect(agpl!.copyleft_type).toBe('network');
  });
});

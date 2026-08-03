import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

describe('EAS build config', () => {
  it('defines demo and production build profiles with explicit API URLs', () => {
    const raw = fs.readFileSync(path.join(process.cwd(), 'eas.json'), 'utf8');
    const config = JSON.parse(raw);

    expect(config.cli.version).toBe('>= 12.0.0');
    expect(config.build.development.developmentClient).toBe(true);
    expect(config.build.preview.distribution).toBe('internal');
    expect(config.build.preview.env.EXPO_PUBLIC_API_BASE_URL).toMatch(/^http:\/\/120\.26\.28\.208\/api\/v1$/);
    expect(config.build.production.env.EXPO_PUBLIC_API_BASE_URL).toMatch(/^https:\/\/.+\/api\/v1$/);
    expect(config.submit.production.ios.ascAppId).toBe('REPLACE_WITH_APP_STORE_CONNECT_APP_ID');
  });

  it('keeps Android demo builds able to reach the HTTP demo API', () => {
    const raw = fs.readFileSync(path.join(process.cwd(), 'app.json'), 'utf8');
    const config = JSON.parse(raw);

    expect(config.expo.plugins).toContain('./plugins/withAndroidCleartextTraffic');
  });
});

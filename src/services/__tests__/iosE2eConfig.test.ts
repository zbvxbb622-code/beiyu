import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from '@jest/globals';

describe('iOS E2E demo configuration', () => {
  it('defines a repeatable Maestro smoke flow for the boss demo', () => {
    const projectRoot = path.resolve(__dirname, '../../..');
    const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const flowPath = path.join(projectRoot, 'e2e/maestro/beiyu-demo.yaml');

    expect(packageJson.scripts['e2e:ios:demo']).toBe('maestro test e2e/maestro/beiyu-demo.yaml');
    expect(fs.existsSync(flowPath)).toBe(true);
    expect(fs.readFileSync(flowPath, 'utf8')).toContain('appId: com.zbvxbb622.beiyu');
  });
});

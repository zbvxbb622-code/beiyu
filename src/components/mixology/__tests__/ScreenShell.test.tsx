import { render } from '@testing-library/react-native';
import { describe, expect, it } from '@jest/globals';
import { Text } from 'react-native';

import { ScreenShell } from '@/components/mixology/ScreenShell';

function flattenStyle(style: unknown) {
  return Array.isArray(style) ? Object.assign({}, ...style) : style;
}

describe('ScreenShell', () => {
  it('uses native layout styles so screens stay visible if NativeWind is unavailable', async () => {
    const screen = await render(
      <ScreenShell>
        <Text>visible content</Text>
      </ScreenShell>
    );

    const tree = screen.toJSON();

    expect(flattenStyle(tree?.props.style)).toEqual(expect.objectContaining({ flex: 1 }));
  });
});

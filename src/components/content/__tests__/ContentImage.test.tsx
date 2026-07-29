import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { describe, expect, it } from '@jest/globals';

import { ContentImage } from '@/components/content/ContentImage';
import { getImageAsset } from '@/data/imageAssets';

describe('ContentImage', () => {
  it('falls back to the bundled image after a remote image fails', async () => {
    const screen = await render(
      <ContentImage
        testID="content-image"
        imageKey="margarita"
        imageUrl="https://cdn.example.com/margarita.jpg"
        style={{ width: 100, height: 100 }}
      />
    );

    expect(screen.getByTestId('content-image').props.source).toEqual({
      uri: 'https://cdn.example.com/margarita.jpg',
    });

    fireEvent(screen.getByTestId('content-image'), 'error', {
      nativeEvent: { error: 'network failed' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('content-image').props.source).toEqual(
        getImageAsset('margarita')
      );
    });
  });
});

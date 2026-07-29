import { useState } from 'react';
import {
  Image,
  ImageBackground,
  type ImageBackgroundProps,
  type ImageProps,
  type ImageURISource,
} from 'react-native';

import { getImageAsset } from '@/data/imageAssets';

type ContentSourceProps = {
  imageKey: string;
  imageUrl?: string | null;
};

type ContentImageProps = ContentSourceProps &
  Omit<ImageProps, 'defaultSource' | 'source'>;

type ContentImageBackgroundProps = ContentSourceProps &
  Omit<ImageBackgroundProps, 'defaultSource' | 'source'>;

function useContentImageSource(
  imageKey: string,
  imageUrl?: string | null
): {
  fallback: ImageURISource | number;
  markRemoteFailed: () => void;
  source: ImageURISource | number;
} {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const fallback = getImageAsset(imageKey);
  const source =
    imageUrl && imageUrl !== failedUrl ? { uri: imageUrl } : fallback;

  return {
    fallback,
    markRemoteFailed: () => {
      if (imageUrl) {
        setFailedUrl(imageUrl);
      }
    },
    source,
  };
}

export function ContentImage({
  imageKey,
  imageUrl,
  onError,
  ...props
}: ContentImageProps) {
  const { fallback, markRemoteFailed, source } = useContentImageSource(
    imageKey,
    imageUrl
  );

  return (
    <Image
      {...props}
      source={source}
      defaultSource={fallback}
      onError={(event) => {
        markRemoteFailed();
        onError?.(event);
      }}
    />
  );
}

export function ContentImageBackground({
  imageKey,
  imageUrl,
  onError,
  ...props
}: ContentImageBackgroundProps) {
  const { fallback, markRemoteFailed, source } = useContentImageSource(
    imageKey,
    imageUrl
  );

  return (
    <ImageBackground
      {...props}
      source={source}
      defaultSource={fallback}
      onError={(event) => {
        markRemoteFailed();
        onError?.(event);
      }}
    />
  );
}

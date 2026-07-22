import { jest } from '@jest/globals';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('lucide-react-native', () => {
  const mockReact = require('react');
  const mockIcon = (props: Record<string, unknown>) => mockReact.createElement('Icon', props);

  return new Proxy({}, { get: () => mockIcon });
});

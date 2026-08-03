import { beforeEach, jest } from '@jest/globals';

const mockSecureStoreValues = new Map<string, string>();
const mockGetItemAsync = jest.fn(async (key: string) => mockSecureStoreValues.get(key) ?? null);
const mockSetItemAsync = jest.fn(async (key: string, value: string) => {
  mockSecureStoreValues.set(key, value);
});
const mockDeleteItemAsync = jest.fn(async (key: string) => {
  mockSecureStoreValues.delete(key);
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('expo-secure-store', () => ({
  getItemAsync: mockGetItemAsync,
  setItemAsync: mockSetItemAsync,
  deleteItemAsync: mockDeleteItemAsync,
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '7c9304c4-4430-4c96-8afd-b5df2b18e2d3'),
}));

jest.mock('expo-constants', () => ({
  expoConfig: { version: '1.0.0' },
  nativeAppVersion: '1.0.0',
}));

jest.mock('expo-device', () => ({
  osName: 'iOS',
  deviceName: 'Test iPhone',
  modelName: 'Test iPhone',
}));

beforeEach(() => {
  mockSecureStoreValues.clear();
  mockGetItemAsync.mockClear();
  mockSetItemAsync.mockClear();
  mockDeleteItemAsync.mockClear();
});

jest.mock('lucide-react-native', () => {
  const mockReact = require('react');
  const mockIcon = (props: Record<string, unknown>) => mockReact.createElement('Icon', props);

  return new Proxy({}, { get: () => mockIcon });
});

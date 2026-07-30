import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'beiyu.refresh-token.v1';

let operationQueue: Promise<void> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = operationQueue.then(operation, operation);
  operationQueue = result.then(() => undefined, () => undefined);
  return result;
}

export const tokenStore = {
  getRefreshToken: () => serialize(() => SecureStore.getItemAsync(REFRESH_TOKEN_KEY)),
  setRefreshToken: (token: string) => serialize(() => SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token)),
  replaceRefreshToken: (expectedToken: string, nextToken: string) => serialize(async () => {
    if (await SecureStore.getItemAsync(REFRESH_TOKEN_KEY) !== expectedToken) return false;
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, nextToken);
    return true;
  }),
  clearRefreshToken: (expectedToken?: string | null) => serialize(async () => {
    if (expectedToken !== undefined && await SecureStore.getItemAsync(REFRESH_TOKEN_KEY) !== expectedToken) {
      return false;
    }
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    return true;
  }),
};

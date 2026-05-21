import NodeCache from 'node-cache';

// Default time-to-live: 10 minutes (600 seconds), cleanup check every 2 minutes
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

export const cacheService = {
  /**
   * Retrieve a value from the cache.
   * @param key Cache key
   */
  get<T>(key: string): T | undefined {
    return cache.get<T>(key);
  },

  /**
   * Store a value in the cache.
   * @param key Cache key
   * @param value Value to store
   * @param ttlSeconds Custom TTL in seconds for this specific key
   */
  set<T>(key: string, value: T, ttlSeconds?: number): boolean {
    if (ttlSeconds !== undefined) {
      return cache.set(key, value, ttlSeconds);
    }
    return cache.set(key, value);
  },

  /**
   * Delete a key or keys from the cache.
   * @param key Cache key or array of keys
   */
  del(key: string | string[]): number {
    return cache.del(key);
  },

  /**
   * Clear all keys from the cache.
   */
  flush(): void {
    cache.flushAll();
  }
};

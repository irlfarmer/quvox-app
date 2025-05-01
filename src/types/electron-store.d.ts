declare module 'electron-store' {
  interface StoreOptions<T> {
    name?: string;
    cwd?: string;
    defaults?: T;
  }

  class Store<T extends Record<string, any>> {
    constructor(options?: StoreOptions<T>);
    store: T;
    get<K extends keyof T>(key: K): T[K];
    set<K extends keyof T>(key: K, value: T[K]): void;
    has<K extends keyof T>(key: K): boolean;
    delete<K extends keyof T>(key: K): void;
    clear(): void;
  }

  export default Store;
} 
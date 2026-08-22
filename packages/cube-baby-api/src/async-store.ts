type AsyncStore<T> = {
  getStore(): T | undefined;
  run<R>(store: T, callback: () => R): R;
};

type BuiltinAsyncHooks = {
  AsyncLocalStorage?: new <T>() => AsyncStore<T>;
};

/**
 * Node: real AsyncLocalStorage via getBuiltinModule (no `node:` import, so Metro
 * does not try to bundle async_hooks). React Native: stack fallback.
 */
function nodeAsyncStore<T>(): AsyncStore<T> | undefined {
  try {
    const hooks = (
      globalThis as { process?: { getBuiltinModule?: (name: string) => BuiltinAsyncHooks | undefined } }
    ).process?.getBuiltinModule?.("async_hooks");
    if (hooks?.AsyncLocalStorage) return new hooks.AsyncLocalStorage<T>();
  } catch {
    return undefined;
  }
  return undefined;
}

class StackAsyncStore<T> implements AsyncStore<T> {
  readonly #stack: T[] = [];

  getStore(): T | undefined {
    return this.#stack.at(-1);
  }

  run<R>(store: T, callback: () => R): R {
    this.#stack.push(store);
    const restore = (): void => {
      const index = this.#stack.lastIndexOf(store);
      if (index >= 0) this.#stack.splice(index, 1);
    };
    try {
      const result = callback();
      if (result != null && typeof (result as { then?: unknown }).then === "function") {
        return Promise.resolve(result).finally(restore) as R;
      }
      restore();
      return result;
    } catch (error) {
      restore();
      throw error;
    }
  }
}

export function createAsyncStore<T>(): AsyncStore<T> {
  return nodeAsyncStore<T>() ?? new StackAsyncStore<T>();
}

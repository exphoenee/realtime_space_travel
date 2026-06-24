/** Generic state updater — accepts a direct value or a function returning the new value */
export type StateUpdater<T> = T | ((prev: T) => T);

/** Resolve a StateUpdater against the current value */
export const resolveState = <T>(updater: StateUpdater<T>, current: T): T => {
  return typeof updater === "function"
    ? (updater as (prev: T) => T)(current)
    : updater;
};

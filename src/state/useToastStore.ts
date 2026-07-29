import { create } from "zustand";

export type ToastType = "info" | "success" | "warning" | "error";

export interface Toast {
  /** Unique id, used as the React key and by dismissToast. */
  id: string;
  type: ToastType;
  /** Already-translated message text. */
  message: string;
  /** How long the toast stays on screen, in ms. */
  duration: number;
  createdAt: number;
}

/** Default lifetime of a toast (ms). */
export const DEFAULT_TOAST_DURATION = 5000;

/** Never show more than this many toasts at once — the oldest is dropped (FIFO). */
export const MAX_TOASTS = 5;

interface ToastState {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  dismissToast: (id: string) => void;
}

let toastCounter = 0;

/**
 * Ephemeral toast queue.
 *
 * Deliberately NOT persisted: a toast that survives a page reload would be
 * shown long after the event it reports. The auto-dismiss timer lives in
 * `ToastContainer`, not here — a `setTimeout` held in the store leaks under
 * React StrictMode double-mounting and in tests.
 */
const useToastStore = create<ToastState>()((set) => ({
  toasts: [],

  addToast: (type, message, duration = DEFAULT_TOAST_DURATION) =>
    set((state) => {
      // Repeatedly clicking a locked button must not stack five identical
      // toasts — an already-visible message is left alone rather than requeued.
      if (state.toasts.some((t) => t.type === type && t.message === message)) {
        return {};
      }
      toastCounter += 1;
      const toast: Toast = {
        id: `toast-${Date.now()}-${toastCounter}`,
        type,
        message,
        duration,
        createdAt: Date.now(),
      };
      const next = [...state.toasts, toast];
      // FIFO overflow: drop the oldest entries beyond the cap.
      return { toasts: next.slice(-MAX_TOASTS) };
    }),

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export default useToastStore;

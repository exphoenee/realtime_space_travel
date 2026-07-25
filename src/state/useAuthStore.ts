import { create } from "zustand";
import type { User } from "firebase/auth";

export type AuthStatus = "loading" | "signedOut" | "anonymous" | "authenticated";

interface AuthState {
  /** Current Firebase user, or null while loading */
  user: User | null;
  /** Auth status */
  status: AuthStatus;
  /** Whether the first auth state check has completed */
  _initialized: boolean;
  /** User's display name */
  displayName: string | null;
  /** Whether the user is anonymous */
  isAnonymous: boolean;
  /** Firebase UID */
  uid: string | null;

  setUser: (user: User | null) => void;
  clearUser: () => void;
}

const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  status: "loading",
  _initialized: false,
  displayName: null,
  isAnonymous: true,
  uid: null,

  setUser: (user) =>
    set((state) => ({
      user,
      _initialized: true,
      status: user
        ? user.isAnonymous
          ? "anonymous"
          : "authenticated"
        : "signedOut",
      displayName: user?.displayName ?? null,
      isAnonymous: user?.isAnonymous ?? true,
      uid: user?.uid ?? null,
    })),

  clearUser: () =>
    set({
      user: null,
      _initialized: true,
      status: "signedOut",
      displayName: null,
      isAnonymous: true,
      uid: null,
    }),
}));

export default useAuthStore;

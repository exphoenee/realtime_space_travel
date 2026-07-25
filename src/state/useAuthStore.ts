import { create } from "zustand";
import type { User } from "firebase/auth";

export type AuthStatus = "loading" | "anonymous" | "authenticated";

interface AuthState {
  /** Current Firebase user, or null while loading */
  user: User | null;
  /** Auth status */
  status: AuthStatus;
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
  displayName: null,
  isAnonymous: true,
  uid: null,

  setUser: (user) =>
    set({
      user,
      status: user ? (user.isAnonymous ? "anonymous" : "authenticated") : "loading",
      displayName: user?.displayName ?? null,
      isAnonymous: user?.isAnonymous ?? true,
      uid: user?.uid ?? null,
    }),

  clearUser: () =>
    set({
      user: null,
      status: "loading",
      displayName: null,
      isAnonymous: true,
      uid: null,
    }),
}));

export default useAuthStore;

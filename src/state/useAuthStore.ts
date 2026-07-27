import { create } from "zustand";
import type { User } from "firebase/auth";
import { getDeviceId } from "../firebase/deviceId";

export type AuthStatus = "loading" | "signedOut" | "anonymous" | "authenticated";

interface AuthState {
  /** Current Firebase user, or null while loading */
  user: User | null;
  /** Auth status */
  status: AuthStatus;
  /** Whether the first auth state check has completed */
  _initialized: boolean;
  /** User's display name from Google Auth */
  displayName: string | null;
  /** Whether the user is anonymous */
  isAnonymous: boolean;
  /** Firebase UID (changes on sign-out / new anonymous login) */
  uid: string | null;
  /** Stable device-based identifier from localStorage (persistent) */
  deviceId: string;
  /** Latest auth/RTDB error as an i18n key, or null */
  authError: string | null;
  /** Custom nickname from RTDB profile.nickname */
  nickname: string;
  /** Whether nickname has been loaded from RTDB */
  nicknameLoaded: boolean;
  /** Merge notice (info-level message, not an error). Shown once then cleared. */
  mergeNotice: string | null;

  setUser: (user: User | null) => void;
  setDisplayName: (name: string) => void;
  clearUser: () => void;
  setAuthError: (msg: string | null) => void;
  setMergeNotice: (msg: string | null) => void;
  setNickname: (nickname: string) => void;
  setDeviceId: (id: string) => void;
}

/**
 * Selector: derive the RTDB key from the current auth state.
 * - Non-anonymous (Google) users ALWAYS use user.uid — this is an invariant.
 * - Anonymous/guests use the persistent deviceId from localStorage.
 *
 * This is a DERIVED value, NOT a writable state field. There is no setRtdbKey
 * action — a structural guarantee that the identity can never be swapped.
 */
export const selectRtdbKey = (s: AuthState): string =>
  s.user && !s.user.isAnonymous ? s.user.uid : s.deviceId;

/** Non-React call sites (store actions, event handlers, authBootstrap). */
export const getRtdbKey = (): string => selectRtdbKey(useAuthStore.getState());

const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  status: "loading",
  _initialized: false,
  displayName: null,
  isAnonymous: true,
  uid: null,
  deviceId: getDeviceId(),
  authError: null,
  nickname: "",
  nicknameLoaded: false,
  mergeNotice: null,

  setUser: (user) =>
    set(() => {
      const deviceId = getDeviceId();
      return {
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
        mergeNotice: null, // reset merge notice on user change
      };
    }),

  setDisplayName: (name) => set({ displayName: name }),

  clearUser: () =>
    set({
      user: null,
      _initialized: true,
      status: "signedOut",
      displayName: null,
      isAnonymous: true,
      uid: null,
      deviceId: getDeviceId(),
      nickname: "",
      nicknameLoaded: false,
      mergeNotice: null,
    }),

  setAuthError: (msg) => set({ authError: msg }),

  setMergeNotice: (msg) => set({ mergeNotice: msg }),

  setNickname: (nickname) => set({ nickname, nicknameLoaded: true }),

  setDeviceId: (id) => set({ deviceId: id }),
}));

export default useAuthStore;

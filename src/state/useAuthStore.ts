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
  /** Stable device-based identifier from localStorage (persistent), used as RTDB key */
  deviceId: string;
  /** Latest auth/RTDB error as an i18n key, or null */
  authError: string | null;
  /** Custom nickname from RTDB profile.nickname */
  nickname: string;
  /** Whether nickname has been loaded from RTDB */
  nicknameLoaded: boolean;
  /**
   * The RTDB path key to use for all user data operations.
   * For guests:   deviceId (persistent localStorage UUID)
   * For logged in: Firebase UID (after migration of guest data)
   */
  rtdbKey: string;

  setUser: (user: User | null) => void;
  setDisplayName: (name: string) => void;
  clearUser: () => void;
  setAuthError: (msg: string | null) => void;
  setNickname: (nickname: string) => void;
  setRtdbKey: (key: string) => void;
  setDeviceId: (id: string) => void;
}

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
  rtdbKey: getDeviceId(),

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
        // Non-anonymous (Google) users use their uid as RTDB key after migration
        rtdbKey: user && !user.isAnonymous ? (user.uid ?? deviceId) : deviceId,
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
      rtdbKey: getDeviceId(),
    }),

  setAuthError: (msg) => set({ authError: msg }),

  setNickname: (nickname) => set({ nickname, nicknameLoaded: true }),

  setRtdbKey: (key) => set({ rtdbKey: key }),

  setDeviceId: (id) => set({ deviceId: id }),
}));

export default useAuthStore;

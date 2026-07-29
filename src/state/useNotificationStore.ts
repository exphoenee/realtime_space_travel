import { create } from "zustand";

interface NotificationState {
  /** Number of unread entries in `notifications/{uid}`. */
  unreadCount: number;
  setUnreadCount: (count: number) => void;
}

/**
 * Remote-derived notification summary.
 *
 * Kept separate from `useToastStore` (which owns the ephemeral on-screen queue)
 * and NOT persisted: the value is a projection of RTDB state, so a stale
 * rehydrated badge would lie until the subscription catches up.
 *
 * `useNotificationListener` (mounted once in App) is the only writer, which is
 * what lets `MainMenu` show the badge without opening a second subscription.
 */
const useNotificationStore = create<NotificationState>()((set) => ({
  unreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: count }),
}));

export default useNotificationStore;

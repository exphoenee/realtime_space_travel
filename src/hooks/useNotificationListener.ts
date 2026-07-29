import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import useAuthStore from "../state/useAuthStore";
import useGameStore from "../state/useGameStore";
import useToastStore, { type ToastType } from "../state/useToastStore";
import useNotificationStore from "../state/useNotificationStore";
import { subscribeNotifications } from "../firebase/userData";
import type { NotificationType } from "../types";

/** Which visual style each event gets. */
const TOAST_TYPE: Record<NotificationType, ToastType> = {
  friendRequest: "info",
  friendRequestAccepted: "success",
  friendRequestRejected: "warning",
  chatMessage: "info",
};

/** i18n key per event — all interpolate `{{name}}`. */
const MESSAGE_KEY: Record<NotificationType, string> = {
  friendRequest: "toast.friendRequest.sent",
  friendRequestAccepted: "toast.friendRequest.accepted",
  friendRequestRejected: "toast.friendRequest.rejected",
  chatMessage: "toast.chatMessage",
};

/**
 * True when the player currently has that friend's chat open, in which case a
 * "new message" toast would just repeat what is already on screen.
 */
const isViewingChatWith = (fromUid: string): boolean => {
  const { gamePhase, chatTargetUid } = useGameStore.getState();
  return gamePhase === "chat" && chatTargetUid === fromUid;
};

/**
 * Subscribe to `notifications/{authUid}` and turn every new unread entry into a
 * toast. Mount ONCE (in App) — it is also the single writer of
 * `useNotificationStore.unreadCount`, which feeds the main-menu badge.
 *
 * Guests are excluded: the social graph is keyed by the Google auth uid, and an
 * anonymous session has no friends to be notified about (same gate as
 * `MainMenu.guardedNav` / `ScreenRouter.needsAccount`).
 *
 * @returns The current number of unread notifications.
 */
export const useNotificationListener = (): number => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const uid = useAuthStore((s) => s.uid);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  const isGuest = !user || user.isAnonymous;

  // `onValue` replays the WHOLE list on every change, so remember which
  // notifications already produced a toast — otherwise a single new entry would
  // re-toast every earlier one.
  const toastedIds = useRef<Set<string>>(new Set());

  // Keep `t` out of the effect deps: it changes identity on every language
  // switch, which would tear down and re-open the RTDB subscription.
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    if (!uid || isGuest) {
      toastedIds.current.clear();
      useNotificationStore.getState().setUnreadCount(0);
      return;
    }

    // A different identity means a different inbox — start the seen-set over.
    toastedIds.current.clear();

    const unsub = subscribeNotifications(uid, (notifications) => {
      const unread = notifications.filter((n) => !n.read);
      useNotificationStore.getState().setUnreadCount(unread.length);

      const { addToast } = useToastStore.getState();
      // Oldest first so the stack reads chronologically top-down.
      for (const notification of [...unread].reverse()) {
        if (toastedIds.current.has(notification.id)) continue;
        toastedIds.current.add(notification.id);

        const type = TOAST_TYPE[notification.type];
        const messageKey = MESSAGE_KEY[notification.type];
        // Unknown/future notification types are recorded as seen but not shown.
        if (!type || !messageKey) continue;

        // Don't announce a message the player is already reading.
        if (
          notification.type === "chatMessage" &&
          isViewingChatWith(notification.fromUid)
        ) {
          continue;
        }

        addToast(
          type,
          tRef.current(messageKey, { name: notification.fromName || notification.fromUid }),
        );
      }
    });

    return unsub;
  }, [uid, isGuest]);

  return unreadCount;
};

export default useNotificationListener;

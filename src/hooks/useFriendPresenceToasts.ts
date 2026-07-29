import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import useAuthStore from "../state/useAuthStore";
import useToastStore from "../state/useToastStore";
import {
  subscribeFriends,
  subscribeUserOnlineStatus,
  lookupUserByUid,
} from "../firebase/userData";
import type { UserOnlineStatus } from "../types";

/**
 * Toast when a friend comes online or goes offline.
 *
 * Deliberately does NOT go through the `notifications/{uid}` node: presence is
 * already broadcast on `usersPublic/{uid}/onlineStatus`, so this is a pure
 * read-side derivation. Writing a notification record per status change would
 * cost one write per friend on every connect/disconnect — for an event nobody
 * needs to see twice.
 *
 * Mount ONCE (in App). Guests are excluded, same gate as the rest of the
 * social features.
 */
export const useFriendPresenceToasts = (): void => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const uid = useAuthStore((s) => s.uid);

  const isGuest = !user || user.isAnonymous;

  // Last status seen per friend. A friend missing from the map has not
  // reported yet, which is what distinguishes "already online when I loaded
  // the page" from "just came online".
  const prevStatus = useRef<Map<string, UserOnlineStatus>>(new Map());

  // Keep `t` out of the effect deps — its identity changes on every language
  // switch, which would tear down and re-open every presence subscription.
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    if (!uid || isGuest) {
      prevStatus.current.clear();
      return;
    }

    // A different identity means a different friend list.
    prevStatus.current.clear();

    let statusUnsubs: (() => void)[] = [];

    const unsubFriends = subscribeFriends(uid, (friendUids) => {
      // Re-subscribe from scratch whenever the friend list changes.
      for (const unsub of statusUnsubs) unsub();
      statusUnsubs = [];

      // Forget removed friends so a re-add starts from a clean baseline.
      for (const known of [...prevStatus.current.keys()]) {
        if (!friendUids.includes(known)) prevStatus.current.delete(known);
      }

      for (const friendUid of friendUids) {
        const unsub = subscribeUserOnlineStatus(friendUid, (status) => {
          const previous = prevStatus.current.get(friendUid);
          prevStatus.current.set(friendUid, status);

          // The first reading is a baseline, not a transition. Without this
          // every already-online friend would toast on page load.
          if (previous === undefined) return;

          // Only the offline boundary matters — online ↔ in-game is noise.
          const cameOnline = previous === "offline" && status !== "offline";
          const wentOffline = previous !== "offline" && status === "offline";
          if (!cameOnline && !wentOffline) return;

          void lookupUserByUid(friendUid)
            .then((profile) => {
              const name =
                profile?.nickname ||
                profile?.displayName ||
                friendUid.slice(0, 8);
              useToastStore
                .getState()
                .addToast(
                  cameOnline ? "success" : "info",
                  tRef.current(
                    cameOnline ? "toast.friendOnline" : "toast.friendOffline",
                    { name },
                  ),
                );
            })
            .catch(console.error);
        });
        statusUnsubs.push(unsub);
      }
    });

    return () => {
      unsubFriends();
      for (const unsub of statusUnsubs) unsub();
    };
  }, [uid, isGuest]);
};

export default useFriendPresenceToasts;

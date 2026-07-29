import { useEffect, useState } from "react";
import useGameStore from "../../state/useGameStore";
import useAuthStore from "../../state/useAuthStore";
import { lookupUserByUid } from "../../firebase/userData";
import ChatPanel from "../features/ChatPanel";
import styles from "./ChatScreen.module.css";

/**
 * Full-screen chat with a single friend — its own GamePhase, like `friends`
 * or `settings`. The conversation partner comes from `chatTargetUid` in the
 * game store, which is persisted, so a page refresh restores this screen
 * instead of dropping back to the friends list.
 *
 * The screen is self-sufficient: it resolves the friend's name from
 * `usersPublic` rather than relying on state held by FriendsScreen, which
 * does not exist after a refresh.
 */
const ChatScreen: React.FC = () => {
  const transitionTo = useGameStore((s) => s.transitionTo);
  const chatTargetUid = useGameStore((s) => s.chatTargetUid);
  const chatTargetName = useGameStore((s) => s.chatTargetName);
  const authUid = useAuthStore((s) => s.uid);

  const [resolvedName, setResolvedName] = useState<string | null>(null);

  // No target (or signed out) — nothing to render, go back to the friends list.
  useEffect(() => {
    if (!chatTargetUid || !authUid) {
      transitionTo("friends");
    }
  }, [chatTargetUid, authUid, transitionTo]);

  // Refresh the friend's display name from the public profile index.
  useEffect(() => {
    if (!chatTargetUid) return;
    let cancelled = false;

    lookupUserByUid(chatTargetUid)
      .then((profile) => {
        if (cancelled || !profile) return;
        const name = profile.nickname || profile.displayName;
        if (name) setResolvedName(name);
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [chatTargetUid]);

  if (!chatTargetUid || !authUid) return null;

  const friendName =
    resolvedName || chatTargetName || chatTargetUid.slice(0, 8);

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <ChatPanel
          authUid={authUid}
          friendUid={chatTargetUid}
          friendName={friendName}
          onBack={() => {
            useGameStore.setState({
              chatTargetUid: null,
              chatTargetName: null,
            });
            transitionTo("friends");
          }}
        />
      </div>
    </div>
  );
};

export default ChatScreen;

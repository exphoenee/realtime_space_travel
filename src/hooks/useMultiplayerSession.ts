import { useState, useEffect, useCallback } from "react";
import useGameStore from "../state/useGameStore";
import type { MultiplayerSession } from "../types";
import {
  createSession as rtdbCreateSession,
  joinSession as rtdbJoinSession,
  leaveSession as rtdbLeaveSession,
  subscribeSession,
  setSessionStatus,
  subscribeMySessions,
} from "../firebase/userData";

/**
 * Hook for managing multiplayer sessions.
 *
 * Provides:
 * - createSession(hostNickname) — creates a new session as host
 * - joinSession(sessionId, nickname) — joins an existing session
 * - leaveCurrentSession() — leaves the current session
 * - startGame() — host transitions session to "playing"
 * - myActiveSessionIds — list of sessions the user is in
 */
export const useMultiplayerSession = (uid: string | null) => {
  const [myActiveSessionIds, setMyActiveSessionIds] = useState<string[]>([]);
  const [sessionData, setSessionData] = useState<MultiplayerSession | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Subscribe to sessions the user is in
  useEffect(() => {
    if (!uid) {
      setMyActiveSessionIds([]);
      return;
    }

    const unsub = subscribeMySessions(uid, (sessionIds) => {
      setMyActiveSessionIds(sessionIds);
      // If we have a stored session and it's no longer active, clean up
      setCurrentSessionId((prev) => {
        if (prev && !sessionIds.includes(prev)) {
          setSessionData(null);
          useGameStore.getState().setMultiplayerSession(null);
          return null;
        }
        return prev;
      });
    });

    return () => {
      unsub();
    };
  }, [uid]);

  // Subscribe to a specific session's data when a session is active
  useEffect(() => {
    if (!currentSessionId) return;

    const unsub = subscribeSession(currentSessionId, (session) => {
      setSessionData(session);
      if (session) {
        useGameStore.getState().setMultiplayerSession(session);
      }
    });

    return () => {
      unsub();
    };
  }, [currentSessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      useGameStore.getState().setMultiplayerSession(null);
    };
  }, []);

  const createSession = useCallback(
    async (hostNickname: string): Promise<string | null> => {
      if (!uid) return null;
      try {
        const sessionId = await rtdbCreateSession(uid, hostNickname);
        setCurrentSessionId(sessionId);
        return sessionId;
      } catch (err) {
        console.error("Failed to create session:", err);
        return null;
      }
    },
    [uid],
  );

  const joinSession = useCallback(
    async (sessionId: string, nickname: string): Promise<boolean> => {
      if (!uid) return false;
      try {
        await rtdbJoinSession(sessionId, uid, nickname);
        setCurrentSessionId(sessionId);
        return true;
      } catch (err) {
        console.error("Failed to join session:", err);
        return false;
      }
    },
    [uid],
  );

  const leaveCurrentSession = useCallback(async (): Promise<void> => {
    if (!currentSessionId || !uid) return;

    try {
      await rtdbLeaveSession(currentSessionId, uid);
    } catch (err) {
      console.error("Failed to leave session:", err);
    }

    setCurrentSessionId(null);
    setSessionData(null);
    useGameStore.getState().setMultiplayerSession(null);
  }, [currentSessionId, uid]);

  const startGame = useCallback(async (): Promise<boolean> => {
    if (!currentSessionId) return false;

    try {
      await setSessionStatus(currentSessionId, "playing");
      return true;
    } catch (err) {
      console.error("Failed to start game:", err);
      return false;
    }
  }, [currentSessionId]);

  return {
    myActiveSessionIds,
    sessionData,
    currentSessionId,
    createSession,
    joinSession,
    leaveCurrentSession,
    startGame,
  };
};

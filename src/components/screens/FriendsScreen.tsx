import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import useGameStore from "../../state/useGameStore";
import useAuthStore from "../../state/useAuthStore";
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  subscribeFriends,
  subscribeOutgoingRequests,
  subscribeFriendRequests,
  subscribeUserOnlineStatus,
  subscribeUnreadCount,
  getChatId,
  searchUsersPublic,
  lookupUserByUid,
  markAllNotificationsRead,
} from "../../firebase/userData";
import type { FriendRequest, UserOnlineStatus, UserPublicProfile } from "../../types";
import { containsForbiddenWords } from "../../constants/constants";
import styles from "./FriendsScreen.module.css";

type Tab = "friends" | "search" | "requests";

interface FriendWithStatus {
  uid: string;
  displayName: string | null;
  nickname: string;
  onlineStatus: UserOnlineStatus;
}

const FriendsScreen: React.FC = () => {
  const { t } = useTranslation();
  const transitionTo = useGameStore((s) => s.transitionTo);
  const authUser = useAuthStore((s) => s.user);
  const authUid = useAuthStore((s) => s.uid);
  const nickname = useAuthStore((s) => s.nickname);
  const displayName = useAuthStore((s) => s.displayName);

  const [activeTab, setActiveTab] = useState<Tab>("friends");
  const [friendUids, setFriendUids] = useState<string[]>([]);
  const [friendsWithStatus, setFriendsWithStatus] = useState<FriendWithStatus[]>([]);
  const [requests, setRequests] = useState<(FriendRequest & { uid: string })[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<UserPublicProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [requestStatus, setRequestStatus] = useState<Record<string, "idle" | "sending" | "sent" | "error">>({});
  const [outgoingPending, setOutgoingPending] = useState<Set<string>>(new Set());
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [uidLookupTerm, setUidLookupTerm] = useState("");
  const [uidLookupResult, setUidLookupResult] = useState<UserPublicProfile | null | undefined>(undefined);
  const [uidLookupStatus, setUidLookupStatus] = useState<"idle" | "looking" | "not-found" | "found" | "error">("idle");

  /** Name the other party sees in their toast when we act on their request. */
  const ownName = nickname || displayName || authUser?.displayName || "Anonymous";

  // Opening this screen counts as seeing the notifications → clear the badge.
  useEffect(() => {
    if (!authUid) return;
    markAllNotificationsRead(authUid).catch(console.error);
  }, [authUid]);

  // Subscribe to friends list
  useEffect(() => {
    if (!authUid) return;
    const unsub = subscribeFriends(authUid, (uids) => {
      setFriendUids(uids);
    });
    return unsub;
  }, [authUid]);

  // Subscribe to friend requests
  useEffect(() => {
    if (!authUid) return;
    const unsub = subscribeFriendRequests(authUid, (reqs) => {
      setRequests(reqs);
    });
    return unsub;
  }, [authUid]);

  // Subscribe to outgoing requests (real-time): when recipient rejects, this fires immediately
  useEffect(() => {
    if (!authUid) return;
    const unsub = subscribeOutgoingRequests(authUid, (pending) => {
      setOutgoingPending(pending);
    });
    return unsub;
  }, [authUid]);

  // Subscribe to online status for each friend
  useEffect(() => {
    if (!authUid) return;

    const unsubs: (() => void)[] = [];

    const updateFriendStatus = (uid: string, status: UserOnlineStatus) => {
      setFriendsWithStatus((prev) => {
        const existing = prev.find((f) => f.uid === uid);
        if (existing) {
          return prev.map((f) =>
            f.uid === uid ? { ...f, onlineStatus: status } : f,
          );
        }
        return prev;
      });
    };

    // Initialize friends status list
    const loadFriendProfiles = async () => {
      const { ref, get } = await import("firebase/database");
      const db = (await import("../../firebase/config")).getFirebaseDB();

      for (const fuid of friendUids) {
        const publicRef = ref(db, `usersPublic/${fuid}`);
        const snap = await get(publicRef);
        const profile = snap.val() as { nickname?: string; displayName?: string | null; onlineStatus?: UserOnlineStatus } | null;
        setFriendsWithStatus((prev) => {
          if (prev.find((f) => f.uid === fuid)) return prev;
          return [
            ...prev,
            {
              uid: fuid,
              displayName: profile?.displayName ?? null,
              nickname: profile?.nickname ?? "",
              onlineStatus: profile?.onlineStatus ?? "offline",
            },
          ];
        });

        const unsub = subscribeUserOnlineStatus(fuid, (status) => {
          updateFriendStatus(fuid, status);
        });
        unsubs.push(unsub);
      }
    };

    loadFriendProfiles();

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [authUid, friendUids.length]);

  // Subscribe to unread message counts for each friend
  useEffect(() => {
    if (!authUid) return;

    const unsubs: (() => void)[] = [];

    for (const fuid of friendUids) {
      const chatId = getChatId(authUid, fuid);
      const unsub = subscribeUnreadCount(chatId, authUid, (count) => {
        setUnreadCounts((prev) => ({
          ...prev,
          [fuid]: count,
        }));
      });
      unsubs.push(unsub);
    }

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [authUid, friendUids.length]);

  // Clean up removed friends
  useEffect(() => {
    setFriendsWithStatus((prev) => prev.filter((f) => friendUids.includes(f.uid)));
  }, [friendUids]);

  // Debounced search — minimum 3 characters
  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (!trimmed || trimmed.length < 3 || !authUid) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      let results = await searchUsersPublic(trimmed, authUid);
      // Filter out users with forbidden words in their name
      results = results.filter(
        (p) =>
          !containsForbiddenWords(p.nickname || "") &&
          !containsForbiddenWords(p.displayName || ""),
      );
      setSearchResults(results);
      setRequestStatus({});
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, authUid]);

  const handleSendRequest = useCallback(
    async (toUid: string, toNickname: string) => {
      if (!authUid) return;
      setRequestStatus((prev) => ({ ...prev, [toUid]: "sending" }));
      // Optimistic update: immediately show "Request sent!"
      // The real-time subscription will confirm/replace this later
      setOutgoingPending((prev) => {
        const next = new Set(prev);
        next.add(toUid);
        return next;
      });
      try {
        await sendFriendRequest(authUid, toUid, ownName);
      } catch (err) {
        console.error("Failed to send friend request:", err);
        // Rollback optimistic update on failure
        setOutgoingPending((prev) => {
          const next = new Set(prev);
          next.delete(toUid);
          return next;
        });
        setRequestStatus((prev) => ({ ...prev, [toUid]: "error" }));
      }
    },
    [authUid, ownName],
  );

  const handleAccept = useCallback(
    async (fromUid: string) => {
      if (!authUid) return;
      try {
        // ownName travels along so the sender's toast reads "X accepted…".
        await acceptFriendRequest(authUid, fromUid, ownName);
      } catch (err) {
        console.error("Failed to accept friend request:", err);
      }
    },
    [authUid, ownName],
  );

  const handleReject = useCallback(
    async (fromUid: string) => {
      if (!authUid) return;
      try {
        await rejectFriendRequest(authUid, fromUid, ownName);
      } catch (err) {
        console.error("Failed to reject friend request:", err);
      }
    },
    [authUid, ownName],
  );

  const handleRemove = useCallback(
    async (friendUid: string) => {
      if (!authUid) return;
      try {
        await removeFriend(authUid, friendUid);
      } catch (err) {
        console.error("Failed to remove friend:", err);
      }
    },
    [authUid],
  );

  const getStatusIcon = (status: UserOnlineStatus): string => {
    switch (status) {
      case "online":
        return "🟢";
      case "in-game":
        return "🟡";
      case "offline":
      default:
        return "⚫";
    }
  };

  const getStatusLabel = (status: UserOnlineStatus): string => {
    switch (status) {
      case "online":
        return t("friends.online");
      case "in-game":
        return t("friends.inGame");
      case "offline":
      default:
        return t("friends.offline");
    }
  };

  const getFriendDisplayName = (friend: FriendWithStatus): string => {
    return friend.nickname || friend.displayName || friend.uid.slice(0, 8);
  };

  const getPublicDisplayName = (profile: UserPublicProfile): string => {
    return profile.nickname || profile.displayName || profile.uid.slice(0, 8);
  };

  // --- UID Lookup ---
  const handleUidLookup = useCallback(async () => {
    const trimmed = uidLookupTerm.trim();
    if (!trimmed || !authUid) return;
    setUidLookupStatus("looking");
    try {
      const profile = await lookupUserByUid(trimmed);
      if (profile) {
        // Filter out users with forbidden words in their name
        if (
          containsForbiddenWords(profile.nickname || "") ||
          containsForbiddenWords(profile.displayName || "")
        ) {
          setUidLookupResult(null);
          setUidLookupStatus("not-found");
        } else {
          setUidLookupResult(profile);
          setUidLookupStatus("found");
        }
      } else {
        setUidLookupResult(null);
        setUidLookupStatus("not-found");
      }
    } catch (err) {
      console.error("UID lookup failed:", err);
      setUidLookupResult(null);
      setUidLookupStatus("error");
    }
  }, [uidLookupTerm, authUid]);

  /** Open the standalone `chat` screen for this friend. */
  const openChat = useCallback((friend: FriendWithStatus) => {
    useGameStore.setState({
      chatTargetUid: friend.uid,
      chatTargetName: getFriendDisplayName(friend),
    });
    transitionTo("chat");
  }, [transitionTo]);

  return (
    <div className={styles.overlay}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => transitionTo("mainMenu")}
          >
            ← {t("friends.back")}
          </button>
          <h2 className={styles.title}>{t("friends.title")}</h2>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "friends" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("friends")}
          >
            {t("friends.title")}
            {friendUids.length > 0 && (
              <span className={styles.badge}>{friendUids.length}</span>
            )}
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "search" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("search")}
          >
            {t("friends.search")}
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === "requests" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("requests")}
          >
            {t("friends.pendingRequests")}
            {requests.length > 0 && (
              <span className={styles.badgeWarning}>{requests.length}</span>
            )}
          </button>
        </div>

        {/* Tab content */}
        <div className={styles.content}>
          {/* Friends List */}
          {activeTab === "friends" && (
            <div className={styles.list}>
              {friendUids.length === 0 ? (
                <p className={styles.empty}>{t("friends.empty")}</p>
              ) : (
                friendsWithStatus.map((friend) => (
                  <div key={friend.uid} className={styles.card}>
                    <div className={styles.cardLeft}>
                      <span className={styles.statusIcon} title={getStatusLabel(friend.onlineStatus)}>
                        {getStatusIcon(friend.onlineStatus)}
                      </span>
                      <span className={styles.cardName}>{getFriendDisplayName(friend)}</span>
                      {unreadCounts[friend.uid] > 0 && (
                        <span className={styles.unreadBadge}>
                          {unreadCounts[friend.uid] > 99 ? "99+" : unreadCounts[friend.uid]}
                        </span>
                      )}
                    </div>
                    <div className={styles.cardRight}>
                      <span className={styles.statusLabel}>
                        {getStatusLabel(friend.onlineStatus)}
                      </span>
                      <button
                        type="button"
                        className={styles.chatBtn}
                        onClick={() => openChat(friend)}
                        title={t("chat.send")}
                      >
                        💬
                      </button>
                      <button
                        type="button"
                        className={styles.wallBtn}
                        onClick={() => {
                          useGameStore.setState({
                            friendWallTargetUid: friend.uid,
                            friendWallTargetName: getFriendDisplayName(friend),
                          });
                          useGameStore.getState().transitionTo("friendWall");
                        }}
                        title={t("friendWall.viewWall")}
                      >
                        🏛️
                      </button>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => handleRemove(friend.uid)}
                        title={t("friends.removeFriend")}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Search */}
          {activeTab === "search" && (
            <div className={styles.searchContainer}>
              {/* Name search */}
              <input
                type="text"
                className={styles.searchInput}
                placeholder={t("friends.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setRequestStatus({});
                }}
                autoFocus
              />
              <div className={styles.list}>
                {isSearching && <p className={styles.loading}>...</p>}
                {!isSearching && searchTerm.trim() && searchTerm.trim().length < 3 && (
                  <p className={styles.minCharHint}>{t("friends.minSearchLength")}</p>
                )}
                {!isSearching && searchTerm.trim().length >= 3 && searchResults.length === 0 && (
                  <p className={styles.empty}>{t("friends.noResults")}</p>
                )}
                {!isSearching &&
                  searchResults.map((profile) => (
                    <div key={profile.uid} className={styles.card}>
                      <div className={styles.cardLeft}>
                        <span className={styles.statusIcon} title={getStatusLabel(profile.onlineStatus)}>
                          {getStatusIcon(profile.onlineStatus)}
                        </span>
                        <span className={styles.cardName}>
                          {getPublicDisplayName(profile)}
                        </span>
                      </div>
                      <div className={styles.cardRight}>
                        {outgoingPending.has(profile.uid) ? (
                          <span className={styles.sentLabel}>
                            {t("friends.friendRequestSent")}
                          </span>
                        ) : friendUids.includes(profile.uid) ? (
                          <span className={styles.alreadyFriendLabel}>
                            ✓
                          </span>
                        ) : (
                          <button
                            type="button"
                            className={styles.addBtn}
                            onClick={() =>
                              handleSendRequest(profile.uid, getPublicDisplayName(profile))
                            }
                            disabled={requestStatus[profile.uid] === "sending"}
                          >
                            {requestStatus[profile.uid] === "sending"
                              ? "..."
                              : t("friends.addFriend")}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>

              {/* UID lookup — exact match only, no fuzzy search */}
              <div className={styles.uidLookupSection}>
                <div className={styles.uidLookupRow}>
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder={t("friends.uidLookupPlaceholder")}
                    value={uidLookupTerm}
                    onChange={(e) => {
                      setUidLookupTerm(e.target.value);
                      setUidLookupStatus("idle");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUidLookup();
                    }}
                  />
                  <button
                    type="button"
                    className={styles.lookupBtn}
                    onClick={handleUidLookup}
                    disabled={uidLookupStatus === "looking" || !uidLookupTerm.trim()}
                  >
                    {uidLookupStatus === "looking" ? "..." : t("friends.lookup")}
                  </button>
                </div>

                {uidLookupStatus === "not-found" && (
                  <p className={styles.uidLookupNotFound}>
                    {t("friends.uidNotFound")}
                  </p>
                )}
                {uidLookupStatus === "error" && (
                  <p className={styles.uidLookupError}>
                    {t("friends.uidLookupError")}
                  </p>
                )}
                {uidLookupStatus === "found" && uidLookupResult && (
                  <div className={styles.card}>
                    <div className={styles.cardLeft}>
                      <span className={styles.statusIcon} title={getStatusLabel(uidLookupResult.onlineStatus)}>
                        {getStatusIcon(uidLookupResult.onlineStatus)}
                      </span>
                      <span className={styles.cardName}>
                        {getPublicDisplayName(uidLookupResult)}
                      </span>
                      <span className={styles.uidLabel}>{uidLookupResult.uid.slice(0, 12)}...</span>
                    </div>
                    <div className={styles.cardRight}>
                      {outgoingPending.has(uidLookupResult.uid) ? (
                        <span className={styles.sentLabel}>
                          {t("friends.friendRequestSent")}
                        </span>
                      ) : uidLookupResult.uid === authUid ? (
                        <span className={styles.alreadyFriendLabel}>
                          {t("friends.thisIsYou")}
                        </span>
                      ) : friendUids.includes(uidLookupResult.uid) ? (
                        <span className={styles.alreadyFriendLabel}>
                          ✓
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={styles.addBtn}
                          onClick={() =>
                            handleSendRequest(uidLookupResult.uid, getPublicDisplayName(uidLookupResult))
                          }
                          disabled={requestStatus[uidLookupResult.uid] === "sending"}
                        >
                          {requestStatus[uidLookupResult.uid] === "sending"
                            ? "..."
                            : t("friends.addFriend")}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Friend Requests */}
          {activeTab === "requests" && (
            <div className={styles.list}>
              {requests.length === 0 ? (
                <p className={styles.empty}>
                  {t("friends.empty")}
                </p>
              ) : (
                requests.map((req) => (
                  <div key={req.uid} className={styles.card}>
                    <div className={styles.cardLeft}>
                      <span className={styles.requestIcon}>📩</span>
                      <span className={styles.cardName}>
                        {req.fromNickname || req.uid.slice(0, 8)}
                      </span>
                    </div>
                    <div className={styles.cardRight}>
                      <button
                        type="button"
                        className={styles.acceptBtn}
                        onClick={() => handleAccept(req.uid)}
                      >
                        {t("friends.accept")}
                      </button>
                      <button
                        type="button"
                        className={styles.rejectBtn}
                        onClick={() => handleReject(req.uid)}
                      >
                        {t("friends.reject")}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendsScreen;

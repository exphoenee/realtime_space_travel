import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getChatId, initChat, sendMessage, subscribeChatMessages, markChatRead, updateTypingStatus, subscribeTypingStatus } from "../../firebase/userData";
import type { ChatMessage } from "../../types";
import styles from "./ChatPanel.module.css";

interface ChatPanelProps {
  /** Current user's UID */
  authUid: string;
  /** Friend's UID */
  friendUid: string;
  /** Friend's display name */
  friendName: string;
  /** Called when the user wants to go back */
  onBack: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ authUid, friendUid, friendName, onBack }) => {
  const { t } = useTranslation();
  const chatId = getChatId(authUid, friendUid);
  const [messages, setMessages] = useState<(ChatMessage & { id: string })[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;
  const authUidRef = useRef(authUid);
  authUidRef.current = authUid;

  // Subscribe to chat messages and mark as read
  useEffect(() => {
    if (!chatId) return;

    // Mark as read when opening the chat
    markChatRead(chatId, authUid).catch(console.error);

    const unsub = subscribeChatMessages(chatId, (msgs) => {
      setMessages(msgs);
      // Mark as read on every new message batch
      markChatRead(chatId, authUid).catch(console.error);
    });

    // Initialize the chat (idempotent)
    initChat(chatId, authUid, friendUid).catch(console.error);

    return () => unsub();
  }, [chatId, authUid, friendUid]);

  // Subscribe to friend's typing status
  useEffect(() => {
    if (!chatId) return;

    const unsub = subscribeTypingStatus(chatId, friendUid, (isTyping) => {
      setFriendTyping(isTyping);
    });

    return () => unsub();
  }, [chatId, friendUid]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Broadcast typing status with 3-second debounce
  const broadcastTyping = useCallback((isTyping: boolean) => {
    const cid = chatIdRef.current;
    const uid = authUidRef.current;
    if (!cid || !uid) return;
    updateTypingStatus(cid, uid, isTyping).catch(console.error);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send typing=true
    broadcastTyping(true);

    // Set auto-clear after 3 seconds
    typingTimeoutRef.current = setTimeout(() => {
      broadcastTyping(false);
      typingTimeoutRef.current = null;
    }, 3000);
  };

  const clearTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    broadcastTyping(false);
  }, [broadcastTyping]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isSending) return;

    setIsSending(true);
    clearTyping();
    try {
      await sendMessage(chatId, authUid, text);
      setInputText("");
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isOwn = (from: string) => from === authUid;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          ← {t("chat.back", "Back")}
        </button>
        <div className={styles.friendInfo}>
          <span className={styles.friendName}>{friendName}</span>
        </div>
        <div className={styles.headerSpacer} />
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>💬</span>
            <p className={styles.emptyText}>{t("chat.empty", "No messages yet")}</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.message} ${isOwn(msg.from) ? styles.own : styles.other}`}
            >
              <div className={styles.messageBubble}>
                {!isOwn(msg.from) && (
                  <span className={styles.senderLabel}>{friendName}</span>
                )}
                <span className={styles.messageText}>{msg.text}</span>
                <span className={styles.messageTime}>{formatTime(msg.at)}</span>
              </div>
            </div>
          ))
        )}

        {/* Typing indicator */}
        {friendTyping && (
          <div className={`${styles.message} ${styles.other}`}>
            <div className={`${styles.messageBubble} ${styles.typingBubble}`}>
              <span className={styles.typingDots}>
                <span className={styles.dot} />
                <span className={styles.dot} />
                <span className={styles.dot} />
              </span>
              <span className={styles.typingLabel}>{friendName} {t("chat.typing", "typing...")}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={styles.inputArea}>
        <input
          type="text"
          className={styles.input}
          placeholder={t("chat.inputPlaceholder")}
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={isSending}
          autoFocus
        />
        <button
          type="button"
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!inputText.trim() || isSending}
        >
          {t("chat.send")}
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;

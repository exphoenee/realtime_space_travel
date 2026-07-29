import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { getChatId, initChat, sendMessage, subscribeChatMessages, markChatRead, updateTypingStatus, subscribeTypingStatus } from "../../firebase/userData";
import { containsForbiddenWords } from "../../constants/constants";
import useAuthStore from "../../state/useAuthStore";
import type { ChatMessage } from "../../types";
import BackButton from "../ui/BackButton";
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
  // Shown in the recipient's toast — resolved here because userData has no
  // access to the auth store's profile fields.
  const ownName = useAuthStore(
    (s) => s.nickname || s.displayName || s.uid?.slice(0, 8) || "",
  );
  const [messages, setMessages] = useState<(ChatMessage & { id: string })[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const [inputWarn, setInputWarn] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

    // Check for forbidden words
    const foundWord = containsForbiddenWords(text);
    if (foundWord) {
      setInputWarn(foundWord);
      // Auto-clear warning after 3 seconds
      setTimeout(() => setInputWarn(null), 3000);
      return;
    }
    setInputWarn(null);

    setIsSending(true);
    clearTyping();
    try {
      await sendMessage(chatId, authUid, text, ownName);
      setInputText("");
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setIsSending(false);
      // Keep the caret in the field so a reply can be typed straight away.
      // Belt-and-braces: the input is no longer disabled while sending (that
      // was what dropped focus), but an async re-render could still steal it.
      inputRef.current?.focus();
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
        <BackButton onClick={onBack}>
          ← {t("chat.back", "Back")}
        </BackButton>
        <div className={styles.friendInfo}>
          <span className={styles.friendName}>{friendName}</span>
        </div>
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
        <div className={styles.inputWrapper}>
          <input
            ref={inputRef}
            type="text"
            className={`${styles.input} ${inputWarn ? styles.inputWarn : ""}`}
            placeholder={t("chat.inputPlaceholder")}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              if (inputWarn) setInputWarn(null);
              // Broadcast typing status
              if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
              }
              broadcastTyping(true);
              typingTimeoutRef.current = setTimeout(() => {
                broadcastTyping(false);
                typingTimeoutRef.current = null;
              }, 3000);
            }}
            onKeyDown={handleKeyDown}
            // NOT disabled while sending: a disabled input is blurred by the
            // browser and does not regain focus, which forced the player to
            // click back in after every Enter. Double-sends are already
            // prevented by the `isSending` guard in handleSend.
            autoFocus
          />
          {inputWarn && (
            <span className={styles.warnText}>
              {t("chat.forbiddenWord")}
            </span>
          )}
        </div>
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

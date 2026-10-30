import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Copy,
  Trash2,
  Image,
  MessageCircle,
  MoreHorizontal,
  PenSquare,
  Phone,
  Search,
  Send,
  Smile,
  Video,
  X,
} from "lucide-react";
import Navbar from "./navpage/Navbar";
import { api } from "./api";
import "./Messages.css";

const defaultAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80";

function Messages() {
  const [chats, setChats] = useState([]);
  const [currentUser, setCurrentUser] = useState({ name: "Your account", avatar: defaultAvatar });
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [activeCall, setActiveCall] = useState(null);
  const [callNotice, setCallNotice] = useState("");
  const attachmentInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.getConversations(), api.getProfile()])
      .then(([conversationResult, profileResult]) => {
        if (!active) return;
        const conversations = conversationResult.conversations;
        setChats(conversations);
        setSelectedChatId(conversations[0]?.id || null);
        setCurrentUser({
          name: profileResult.profile.name,
          avatar: profileResult.profile.avatar || defaultAvatar,
        });
        if (conversations[0]?.unread) {
          api.readConversation(conversations[0].id)
            .then(() => {
              if (active) {
                setChats((current) => current.map((chat) =>
                  chat.id === conversations[0].id ? { ...chat, unread: 0 } : chat,
                ));
              }
            })
            .catch((readError) => {
              if (active) setError(readError.message);
            });
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedChat = chats.find((chat) => chat.id === selectedChatId);
  const filteredChats = useMemo(() => {
    const query = search.trim().toLowerCase();
    return chats.filter((chat) => {
      const lastMessage = chat.messages[chat.messages.length - 1];
      const matchesSearch =
        !query ||
        `${chat.name} ${chat.handle} ${lastMessage?.text || ""}`
          .toLowerCase()
          .includes(query);
      return matchesSearch && (!showUnreadOnly || chat.unread > 0);
    });
  }, [chats, search, showUnreadOnly]);

  const selectChat = async (chatId) => {
    setSelectedChatId(chatId);
    setError("");
    try {
      await api.readConversation(chatId);
      setChats((currentChats) =>
        currentChats.map((chat) =>
          chat.id === chatId ? { ...chat, unread: 0 } : chat,
        ),
      );
    } catch (readError) {
      setError(readError.message);
    }
  };

  const deleteMessage = async (messageId) => {
    if (!selectedChat) return;
    try {
      await api.deleteMessage(messageId);
      setChats((currentChats) =>
        currentChats.map((chat) =>
          chat.id === selectedChat.id
            ? { ...chat, messages: chat.messages.filter((message) => message.id !== messageId) }
            : chat,
        ),
      );
      setError("");
    } catch (deleteError) {
      setError(deleteError.message);
    }
  };

  const startCall = (mode) => {
    if (!selectedChat) return;
    const randomBytes = new Uint8Array(16);
    if (!window.crypto?.getRandomValues) {
      setError("Secure call links are not supported by this browser.");
      return;
    }
    window.crypto.getRandomValues(randomBytes);
    const roomId = Array.from(randomBytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    setActiveCall({
      mode,
      roomId: `vyntra-${roomId}`,
      name: selectedChat.name,
    });
    setCallNotice("");
    setError("");
  };

  const shareCallInvite = async () => {
    if (!activeCall) return;
    const callUrl = `https://meet.jit.si/${activeCall.roomId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${activeCall.mode === "voice" ? "Voice" : "Video"} call with ${activeCall.name}`,
          text: `Join my Vyntra call with ${activeCall.name}.`,
          url: callUrl,
        });
        setCallNotice("Call invite shared.");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(callUrl);
        setCallNotice("Call link copied. Send it to invite them.");
      } else {
        throw new Error("Sharing is not available in this browser.");
      }
    } catch (shareError) {
      if (shareError.name !== "AbortError") {
        setCallNotice(shareError.message || "The call invite could not be shared.");
      }
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if ((!text && !attachment) || !selectedChat) return;

    setIsSending(true);
    try {
      const result = await api.sendMessage(selectedChat.id, { content: text, image: attachment });
      setChats((currentChats) =>
        currentChats.map((chat) =>
          chat.id === selectedChat.id
            ? { ...chat, messages: [...chat.messages, result.message], unread: 0 }
            : chat,
        ),
      );
      setDraft("");
      setAttachment("");
      setError("");
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleAttachmentChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAttachment(reader.result);
        setError("");
      } else {
        setError("The selected image could not be loaded.");
      }
    };
    reader.onerror = () => setError("The selected image could not be loaded.");
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const shareChat = async () => {
    if (!navigator.clipboard?.writeText) {
      setError("Clipboard access is not available in this browser.");
      return;
    }
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/messages?to=${encodeURIComponent(selectedChat.handle)}`,
      );
      setError("Conversation link copied.");
    } catch (shareError) {
      setError(shareError.message || "Could not copy the conversation link.");
    }
  };

  return (
    <div className="messages-page">
      <Navbar />
      <main className="messages-layout">
        <header className="messages-page-heading">
          <div>
            <span className="messages-eyebrow">STAY IN THE LOOP</span>
            <h1>Your messages</h1>
            <p>Good conversations make the day a little brighter.</p>
          </div>
          <button
            className="new-message-button"
            type="button"
            onClick={() => {
              setSearch("");
              setShowUnreadOnly(false);
              setSelectedChatId(null);
            }}
          >
            <PenSquare size={16} />
            New message
          </button>
        </header>

        <section className="messenger-shell" aria-label="Messages">
          {isLoading && <p className="message-feedback" role="status">Loading conversations...</p>}
          {error && !selectedChat && <p className="message-feedback" role="alert">{error}</p>}
          <aside className={`chat-list-panel${selectedChatId ? "" : " chat-list-mobile-active"}`}>
            <div className="chat-list-header">
              <div className="chat-list-title">
                <h2>Inbox</h2>
                <span>{chats.reduce((total, chat) => total + chat.unread, 0)}</span>
              </div>
              <button
                type="button"
                className="inbox-filter"
                onClick={() => setShowUnreadOnly((current) => !current)}
                aria-pressed={showUnreadOnly}
              >
                {showUnreadOnly ? "Unread" : "All"}
              </button>
            </div>

            <label className="chat-search">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search messages"
                aria-label="Search conversations"
              />
            </label>

            <div className="chat-list">
              {filteredChats.map((chat) => {
                const lastMessage = chat.messages[chat.messages.length - 1];
                return (
                  <button
                    type="button"
                    key={chat.id}
                    className={`chat-list-item${selectedChatId === chat.id ? " selected" : ""}`}
                    onClick={() => selectChat(chat.id)}
                  >
                    <span className="chat-avatar-wrap">
                      <img src={chat.avatar || defaultAvatar} alt="" />
                      {chat.online && <i className="online-indicator" />}
                    </span>
                    <span className="chat-preview">
                      <span className="chat-preview-top">
                        <strong>{chat.name}</strong>
                        <time>{lastMessage?.time}</time>
                      </span>
                      <span className="chat-preview-bottom">
                        <span>{lastMessage?.from === "me" ? "You: " : ""}{lastMessage?.text}</span>
                        {chat.unread > 0 && <i>{chat.unread}</i>}
                      </span>
                    </span>
                  </button>
                );
              })}
              {filteredChats.length === 0 && (
                <p className="no-conversations">
                  {showUnreadOnly ? "No unread conversations." : "No conversations found."}
                </p>
              )}
            </div>
            <div className="chat-list-footer">
              <img src={currentUser.avatar} alt="" />
              <div><strong>{currentUser.name}</strong><span>Your account</span></div>
              <span className="account-status">● Active</span>
            </div>
          </aside>

          <section className={`conversation-panel${selectedChatId ? " conversation-mobile-active" : ""}`}>
            {selectedChat ? (
              <>
                <header className="conversation-header">
                  <button
                    type="button"
                    className="back-to-chats"
                    onClick={() => setSelectedChatId(null)}
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft size={19} />
                  </button>
                  <span className="conversation-avatar-wrap">
                    <img src={selectedChat.avatar || defaultAvatar} alt="" />
                    {selectedChat.online && <i className="online-indicator" />}
                  </span>
                  <div className="conversation-person">
                    <strong>{selectedChat.name}</strong>
                    <span>{selectedChat.online ? "Active now" : selectedChat.handle}</span>
                  </div>
                  <div className="conversation-tools">
                    <button
                      type="button"
                      aria-label="Voice call"
                      title="Start voice call"
                      onClick={() => startCall("voice")}
                    >
                      <Phone size={18} />
                    </button>
                    <button
                      type="button"
                      aria-label="Video call"
                      title="Start video call"
                      onClick={() => startCall("video")}
                    >
                      <Video size={19} />
                    </button>
                    <button type="button" aria-label="Copy conversation link" onClick={shareChat}>
                      <MoreHorizontal size={20} />
                    </button>
                  </div>
                </header>

                <div className="conversation-body">
                  <div className="conversation-intro">
                    <img src={selectedChat.avatar || defaultAvatar} alt="" />
                    <strong>{selectedChat.name}</strong>
                    <span>{selectedChat.handle} · You’re connected on Vyntra</span>
                    <span className="view-profile-link">View profile</span>
                  </div>
                  <div className="message-day-divider"><span>Today</span></div>
                  <div className="message-stack">
                    {selectedChat.messages.map((message) => (
                      <div
                        className={`message-row${message.from === "me" ? " sent" : ""}`}
                        key={message.id}
                      >
                        {message.from === "them" && (
                          <img className="message-avatar" src={selectedChat.avatar || defaultAvatar} alt="" />
                        )}
                        <div className="message-content">
                          <div className={`message-bubble${message.from === "me" ? " outgoing" : ""}`}>
                            {message.text}
                            {message.image && (
                              <img className="message-attachment" src={message.image} alt="Message attachment" />
                            )}
                          </div>
                          <span className="message-time">
                            {message.time}
                            {message.from === "me" && (
                              <>
                                <button
                                  type="button"
                                  className="delete-message-button"
                                  onClick={() => deleteMessage(message.id)}
                                  aria-label="Delete message"
                                  title="Delete message"
                                >
                                  <Trash2 size={13} />
                                </button>
                                {message.read
                                  ? <CheckCheck size={13} aria-label="Read" />
                                  : <Check size={13} aria-label="Sent" />}
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {error && <p className="message-feedback" role="status">{error}</p>}
                {attachment && (
                  <div className="message-attachment-preview">
                    <img src={attachment} alt="Selected message attachment" />
                    <button
                      type="button"
                      onClick={() => setAttachment("")}
                      aria-label="Remove attached photo"
                    >
                      ×
                    </button>
                  </div>
                )}
                <input
                  ref={attachmentInputRef}
                  className="message-file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleAttachmentChange}
                  aria-label="Choose an image to send"
                />
                <form className="message-composer" onSubmit={sendMessage}>
                  <button
                    type="button"
                    aria-label="Add photo"
                    className="composer-tool"
                    onClick={() => attachmentInputRef.current?.click()}
                  >
                    <Image size={19} />
                  </button>
                  <input
                    type="text"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={attachment ? "Add a message or send this photo..." : `Message ${selectedChat.name}...`}
                    aria-label={`Message ${selectedChat.name}`}
                  />
                  <button
                    type="button"
                    aria-label="Add smile emoji"
                    className="composer-tool"
                    onClick={() => setDraft((currentDraft) => `${currentDraft}😊`)}
                  >
                    <Smile size={19} />
                  </button>
                  <button
                    type="submit"
                    className="send-message-button"
                    disabled={isSending || (!draft.trim() && !attachment)}
                    aria-busy={isSending}
                    aria-label="Send message"
                  >
                    <Send size={17} />
                  </button>
                </form>
              </>
            ) : (
              <div className="conversation-empty">
                <div className="empty-message-icon"><MessageCircle size={29} /></div>
                <h2>Start a conversation</h2>
                <p>Pick someone from your inbox to say hello.</p>
                <button type="button" onClick={() => setSelectedChatId(chats[0]?.id || null)}>
                  Choose a conversation
                </button>
              </div>
            )}
          </section>
        </section>
      </main>
      {activeCall && (
        <div
          className="call-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveCall(null);
          }}
        >
          <section
            className="call-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="call-modal-title"
          >
            <header className="call-modal-header">
              <div>
                <span className="messages-eyebrow">VIA JITSI MEET</span>
                <h2 id="call-modal-title">
                  {activeCall.mode === "voice" ? "Voice call" : "Video call"} with {activeCall.name}
                </h2>
              </div>
              <button
                type="button"
                className="call-modal-close"
                onClick={() => setActiveCall(null)}
                aria-label="End call and close"
              >
                <X size={20} />
              </button>
            </header>
            <p className="call-privacy-note">
              Your call uses Jitsi Meet. Allow camera and microphone access when prompted.
              Share the invite link with {activeCall.name} so they can join this room.
            </p>
            <div className="call-invite-row">
              <input
                type="text"
                readOnly
                value={`https://meet.jit.si/${activeCall.roomId}`}
                aria-label="Call invitation link"
                onFocus={(event) => event.target.select()}
              />
              <button type="button" onClick={shareCallInvite}>
                <Copy size={15} /> Invite
              </button>
            </div>
            {callNotice && <p className="call-notice" role="status">{callNotice}</p>}
            <div className="call-frame-wrap">
              <iframe
                key={activeCall.roomId}
                title={`${activeCall.mode} call with ${activeCall.name}`}
                src={`https://meet.jit.si/${activeCall.roomId}#config.startWithVideoMuted=${activeCall.mode === "voice"}&config.prejoinPageEnabled=false`}
                allow="camera; microphone; fullscreen; display-capture; autoplay"
                referrerPolicy="no-referrer"
              />
            </div>
            <footer className="call-modal-footer">
              <span>Anyone with the invite link can join this call.</span>
              <button type="button" onClick={() => setActiveCall(null)}>End call</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

export default Messages;

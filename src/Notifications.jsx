import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AtSign,
  Bell,
  CheckCheck,
  Heart,
  MessageCircle,
  Trash2,
  UserRoundPlus,
} from "lucide-react";
import Navbar from "./navpage/Navbar";
import { api } from "./api";
import "./Notifications.css";

const defaultAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&h=100&q=80";

const filters = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "likes", label: "Likes" },
  { id: "comments", label: "Comments" },
  { id: "follows", label: "Follows" },
  { id: "mentions", label: "Mentions" },
];

const typeIcons = {
  like: Heart,
  comment: MessageCircle,
  follow: UserRoundPlus,
  mention: AtSign,
};

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [activeFilter, setActiveFilter] = useState("all");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const unreadCount = notifications.filter((notification) => notification.unread).length;

  useEffect(() => {
    let active = true;
    api.getNotifications()
      .then((result) => {
        if (active) setNotifications(result.notifications);
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

  const filteredNotifications = useMemo(
    () =>
      notifications.filter((notification) => {
        if (activeFilter === "all") return true;
        if (activeFilter === "unread") return notification.unread;
        return notification.category === activeFilter;
      }),
    [activeFilter, notifications],
  );

  const markAllAsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, unread: false })),
      );
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id ? { ...notification, unread: false } : notification,
        ),
      );
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const removeNotification = async (id) => {
    try {
      await api.deleteNotification(id);
      setNotifications((current) => current.filter((notification) => notification.id !== id));
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const clearNotifications = async () => {
    try {
      await api.clearNotifications();
      setNotifications([]);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <div className="notifications-page">
      <Navbar />
      <main className="notifications-layout">
        <header className="notifications-heading">
          <div>
            <span className="notifications-eyebrow">YOUR COMMUNITY, IN THE KNOW</span>
            <h1>Notifications <span>{unreadCount}</span></h1>
            <p>Little updates from the people and conversations you care about.</p>
          </div>
          <div className="notifications-heading-actions">
            <button
              type="button"
              className="mark-all-button"
              onClick={markAllAsRead}
              disabled={!unreadCount}
            >
              <CheckCheck size={16} />
              Mark all as read
            </button>
            <button
              type="button"
              className="clear-notifications-button"
              onClick={clearNotifications}
              disabled={!notifications.length}
            >
              <Trash2 size={15} />
              Clear all
            </button>
          </div>
        </header>

        <div className="notifications-shell">
          <aside className="notifications-sidebar">
            <div className="notification-summary-icon"><Bell size={23} /></div>
            <h2>You’re all caught up?</h2>
            <p>We’ll let you know when something new happens in your Vyntra community.</p>
            <div className="notification-summary-count">
              <strong>{unreadCount}</strong>
              <span>unread updates</span>
            </div>
            <Link to="/explore" className="notifications-explore-link">
              Explore your community <span>→</span>
            </Link>
          </aside>

          <section className="notification-feed" aria-label="Your notifications">
            {error && <p className="notification-error" role="alert">{error}</p>}
            {isLoading && <p className="notification-loading" role="status">Loading notifications...</p>}
            <div className="notification-feed-header">
              <div>
                <h2>Activity</h2>
                <span>{filteredNotifications.length} updates</span>
              </div>
              <span className="notification-live"><i /> Live activity</span>
            </div>

            <div className="notification-filters" aria-label="Filter notifications">
              {filters.map((filter) => (
                <button
                  type="button"
                  key={filter.id}
                  className={activeFilter === filter.id ? "active" : ""}
                  onClick={() => setActiveFilter(filter.id)}
                  aria-pressed={activeFilter === filter.id}
                >
                  {filter.label}
                  {filter.id === "unread" && unreadCount > 0 && (
                    <span>{unreadCount}</span>
                  )}
                </button>
              ))}
            </div>

            {filteredNotifications.length ? (
              <div className="notification-list">
                {filteredNotifications.map((notification) => {
                  const Icon = typeIcons[notification.type];
                  return (
                    <article
                      className={`notification-item${notification.unread ? " unread" : ""}`}
                      key={notification.id}
                    >
                      <Link
                        className="notification-main"
                        to={notification.href}
                        onClick={() => markAsRead(notification.id)}
                      >
                        <span className="notification-avatar-wrap">
                          <img src={notification.avatar || defaultAvatar} alt="" />
                          <i className={`notification-type-icon type-${notification.type}`}>
                            <Icon size={12} fill={notification.type === "like" ? "currentColor" : "none"} />
                          </i>
                        </span>
                        <span className="notification-copy">
                          <span className="notification-text">
                            <strong>{notification.actor}</strong>{" "}
                            <span>{notification.message}</span>
                          </span>
                          <span className="notification-handle">{notification.handle}</span>
                          {notification.detail && (
                            <span className="notification-detail">{notification.detail}</span>
                          )}
                          <time>{notification.time}</time>
                        </span>
                      </Link>
                      <div className="notification-controls">
                        {notification.unread && <span className="unread-dot" aria-label="Unread" />}
                        <button
                          type="button"
                          onClick={() => removeNotification(notification.id)}
                          aria-label={`Remove notification from ${notification.actor}`}
                          title="Remove notification"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="notifications-empty">
                <div><Bell size={23} /></div>
                <strong>{notifications.length ? "You’re all caught up" : "No notifications yet"}</strong>
                <p>
                  {notifications.length
                    ? "Nothing here for this filter. Check back when there’s new activity."
                    : "When people interact with your posts, you’ll see it here."}
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default Notifications;

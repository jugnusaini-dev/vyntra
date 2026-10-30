export async function apiRequest(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let payload = {};
  try {
    payload = await response.json();
  } catch (error) {
    if (response.ok) throw new Error("The server returned an invalid response.");
  }

  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export const api = {
  signup: (body) => apiRequest("/auth/signup", { method: "POST", body }),
  login: (body) => apiRequest("/auth/login", { method: "POST", body }),
  logout: () => apiRequest("/auth/logout", { method: "POST", body: {} }),
  leaveAccount: () => apiRequest("/auth/leave", { method: "POST", body: {} }),
  switchAccount: (userId) =>
    apiRequest("/auth/switch", { method: "POST", body: { userId } }),
  forgetSavedAccount: (userId) =>
    apiRequest("/auth/forget", { method: "POST", body: { userId } }),
  me: () => apiRequest("/auth/me"),
  getProfile: () => apiRequest("/profile/me"),
  updateProfile: (body) => apiRequest("/profile", { method: "PATCH", body }),
  getPosts: (following = false) =>
    apiRequest(`/posts${following ? "?feed=following" : ""}`),
  createPost: (body) => apiRequest("/posts", { method: "POST", body }),
  deletePost: (id) => apiRequest(`/posts/${encodeURIComponent(id)}`, { method: "DELETE" }),
  setPostLike: (id, liked) =>
    apiRequest(`/posts/${encodeURIComponent(id)}/like`, { method: liked ? "PUT" : "DELETE" }),
  sharePost: (id) =>
    apiRequest(`/posts/${encodeURIComponent(id)}/share`, { method: "POST", body: {} }),
  addComment: (id, content) =>
    apiRequest(`/posts/${encodeURIComponent(id)}/comments`, { method: "POST", body: { content } }),
  setCommentLike: (id, liked) =>
    apiRequest(`/comments/${encodeURIComponent(id)}/like`, { method: liked ? "PUT" : "DELETE" }),
  getFollows: () => apiRequest("/follows"),
  getFollowLists: () => apiRequest("/follows/lists"),
  setFollow: (id, following) =>
    apiRequest(`/users/${encodeURIComponent(id)}/follow`, { method: following ? "PUT" : "DELETE" }),
  getExplore: (query = "", category = "All") =>
    apiRequest(`/explore?query=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}`),
  getConversations: () => apiRequest("/messages"),
  readConversation: (id) =>
    apiRequest(`/messages/${encodeURIComponent(id)}/read`, { method: "PATCH", body: {} }),
  sendMessage: (id, body) =>
    apiRequest(`/messages/${encodeURIComponent(id)}`, { method: "POST", body }),
  deleteMessage: (id) =>
    apiRequest(`/messages/${encodeURIComponent(id)}/delete`, { method: "DELETE" }),
  getNotifications: () => apiRequest("/notifications"),
  markNotificationRead: (id) =>
    apiRequest(`/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH", body: {} }),
  markAllNotificationsRead: () =>
    apiRequest("/notifications/read-all", { method: "POST", body: {} }),
  deleteNotification: (id) =>
    apiRequest(`/notifications/${encodeURIComponent(id)}`, { method: "DELETE" }),
  clearNotifications: () => apiRequest("/notifications", { method: "DELETE" }),
};

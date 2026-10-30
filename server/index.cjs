const { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual, createHmac } = require("node:crypto");
const { createServer } = require("node:http");
const { createReadStream, existsSync, mkdirSync, statSync } = require("node:fs");
const { dirname, extname, relative, resolve, sep } = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { promisify } = require("node:util");

const scryptAsync = promisify(scrypt);
const port = Number(process.env.PORT || 4000);
const databasePath = resolve(process.env.VYNTRA_DB_PATH || "data/vyntra.sqlite");
const buildPath = resolve(__dirname, "..", "build");
mkdirSync(dirname(databasePath), { recursive: true });

const db = new DatabaseSync(databasePath);
db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL DEFAULT '',
    password_hash TEXT,
    bio TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    website TEXT NOT NULL DEFAULT '',
    avatar TEXT NOT NULL DEFAULT '',
    cover TEXT NOT NULL DEFAULT '',
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS likes (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, post_id)
  );
  CREATE TABLE IF NOT EXISTS shares (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, post_id)
  );
  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS comment_likes (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, comment_id)
  );
  CREATE TABLE IF NOT EXISTS follows (
    follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followed_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY (follower_id, followed_id),
    CHECK (follower_id != followed_id)
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    image TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    read_at TEXT
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'mention')),
    post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,
    comment_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
    detail TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    read_at TEXT
  );
  CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts(created_at DESC);
  CREATE INDEX IF NOT EXISTS comments_post_id_idx ON comments(post_id, created_at);
  CREATE INDEX IF NOT EXISTS messages_pair_idx ON messages(sender_id, recipient_id, created_at);
  CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON notifications(recipient_id, created_at DESC);
`);

const userColumns = new Set(db.prepare("PRAGMA table_info(users)").all().map((column) => column.name));
if (!userColumns.has("display_name")) {
  db.exec("ALTER TABLE users ADD COLUMN display_name TEXT NOT NULL DEFAULT ''");
  db.exec("UPDATE users SET display_name = username WHERE display_name = ''");
}

const demoUsers = [
  {
    id: "demo-maya", username: "Maya Chen", email: "maya@vyntra.local",
    avatar: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=160&h=160&q=80",
    bio: "Finding beauty in the everyday 🌷", location: "Mumbai, India", website: "",
  },
  {
    id: "demo-alex", username: "Alex Morgan", email: "alex@vyntra.local",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&h=160&q=80",
    bio: "Coffee, calm mornings, and good conversations.", location: "Pune, India", website: "",
  },
  {
    id: "demo-daniel", username: "Daniel Kim", email: "daniel@vyntra.local",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=160&h=160&q=80",
    bio: "Design, music, and little experiments.", location: "Bengaluru, India", website: "",
  },
  {
    id: "demo-sophia", username: "Sophia Lee", email: "sophia@vyntra.local",
    avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=160&h=160&q=80",
    bio: "Good food, new places, better stories ✈️", location: "Delhi, India", website: "",
  },
  {
    id: "demo-ryan", username: "Ryan Brooks", email: "ryan@vyntra.local",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=160&h=160&q=80",
    bio: "Outside whenever I can be 🌿", location: "Jaipur, India", website: "",
  },
];

const creatorCategories = {
  "demo-maya": "Photography",
  "demo-alex": "Lifestyle",
  "demo-daniel": "Design",
  "demo-sophia": "Travel",
  "demo-ryan": "Lifestyle",
};

const demoPosts = [
  {
    id: "demo-post-alex",
    userId: "demo-alex",
    content: "Sometimes all you need is a slow morning, good coffee, and a little reminder that you’re right where you need to be. ☕️ #SundayReset",
    image: "https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1000&q=85",
    createdAt: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
  },
  {
    id: "demo-post-maya",
    userId: "demo-maya",
    content: "A little weekend color for your feed 🌷 Hope you’re finding something lovely in the little things today. #PhotoDiary #LittleJoy",
    image: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1000&q=85",
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    id: "demo-post-sophia",
    userId: "demo-sophia",
    content: "Found a quiet corner of the coast and forgot what time it was. More mornings like this, please. 🌊 #WanderOften",
    image: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1000&q=85",
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "demo-post-daniel",
    userId: "demo-daniel",
    content: "A few colors and shapes from the sketchbook this week. Which one feels like Friday? 🎨 #CreativeMinds",
    image: "https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1000&q=85",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
];

function seedDemoContent() {
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users
      (id, email, username, bio, location, website, avatar, is_demo, created_at)
    VALUES (?, ?, ?, ?, ?, '', ?, 1, ?)
  `);
  for (const user of demoUsers) {
    insertUser.run(user.id, user.email, user.username, user.bio, user.location, user.avatar, new Date().toISOString());
  }
  const insertPost = db.prepare(`
    INSERT OR IGNORE INTO posts (id, user_id, content, image, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const post of demoPosts) {
    insertPost.run(post.id, post.userId, post.content, post.image, post.createdAt);
  }
};
seedDemoContent();

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const now = () => new Date().toISOString();
const makeId = () => randomUUID();
const hashToken = (token) => createHash("sha256").update(token).digest("hex");

function relativeTime(value) {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.display_name || row.username,
    username: row.username,
    handle: `@${row.username.toLowerCase().replace(/[^a-z0-9_.]/g, "")}`,
    email: row.email,
    bio: row.bio,
    location: row.location,
    website: row.website,
    avatar: row.avatar,
    cover: row.cover,
    createdAt: row.created_at,
  };
}

function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

function requireString(value, label, maxLength, allowEmpty = false) {
  if (typeof value !== "string") throw new ApiError(400, `${label} must be text.`);
  const trimmed = value.trim();
  if (!allowEmpty && !trimmed) throw new ApiError(400, `${label} is required.`);
  if (trimmed.length > maxLength) throw new ApiError(400, `${label} is too long.`);
  return trimmed;
}

function validateImage(value) {
  if (value == null || value === "") return "";
  if (typeof value !== "string" || !/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value)) {
    throw new ApiError(400, "Image must be uploaded as PNG, JPEG, WebP, or GIF.");
  }
  if (value.length > 5_600_000) throw new ApiError(413, "Image must be smaller than 4 MB.");
  return value;
}

function parseCookies(req) {
  return Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => key && value)
      .map(([key, ...value]) => [key, value.join("=")]),
  );
}

function sessionCookie(token, maxAge = 2592000) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `vyntra_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function accountCookieName(userId) {
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(userId)) throw new ApiError(400, "Account is invalid.");
  return `vyntra_account_${userId}`;
}

function accountSessionCookie(userId, token, maxAge = 2592000) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${accountCookieName(userId)}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie", sessionCookie(token));
}

function setAccountSessionCookie(res, userId, token) {
  res.setHeader("Set-Cookie", accountSessionCookie(userId, token));
}

function clearSessionCookie(res, userId = null) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const cookies = [`vyntra_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`];
  if (userId) {
    cookies.push(`${accountCookieName(userId)}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
  }
  res.setHeader("Set-Cookie", cookies);
}

function currentUser(req) {
  const token = parseCookies(req).vyntra_session;
  if (!token) throw new ApiError(401, "Please log in to continue.");
  const session = db.prepare(`
    SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?
  `).get(hashToken(token), now());
  if (!session) throw new ApiError(401, "Your session expired. Please log in again.");
  const user = getUserById(session.user_id);
  if (!user) throw new ApiError(401, "Your account is not available.");
  return user;
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8_000_000) throw new ApiError(413, "Request is too large.");
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.");
  }
}

function send(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(data));
}

function serveFrontend(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 404, { error: "Not found." });
    return;
  }

  if (!existsSync(resolve(buildPath, "index.html"))) {
    send(res, 503, { error: "The frontend build is missing. Run npm run build before starting the production server." });
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    send(res, 400, { error: "Invalid URL path." });
    return;
  }

  const requestedPath = resolve(buildPath, `.${pathname}`);
  const pathFromBuild = relative(buildPath, requestedPath);
  if (pathFromBuild === ".." || pathFromBuild.startsWith(`..${sep}`)) {
    send(res, 400, { error: "Invalid URL path." });
    return;
  }

  let filePath = requestedPath;
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    if (extname(pathname)) {
      send(res, 404, { error: "Not found." });
      return;
    }
    filePath = resolve(buildPath, "index.html");
  }

  const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ttf": "font/ttf",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  };
  res.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
  });

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  const stream = createReadStream(filePath);
  stream.on("error", (error) => {
    console.error(error);
    if (res.headersSent) {
      res.destroy();
      return;
    }
    send(res, 500, { error: "Could not read the frontend file." });
  });
  stream.pipe(res);
}

function notify(recipientId, actorId, type, postId = null, commentId = null, detail = "") {
  if (recipientId === actorId) return;
  db.prepare(`
    INSERT INTO notifications (id, recipient_id, actor_id, type, post_id, comment_id, detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(makeId(), recipientId, actorId, type, postId, commentId, detail.slice(0, 240), now());
}

function postPayload(postId, viewerId) {
  const post = db.prepare(`
    SELECT p.*, u.username, COALESCE(NULLIF(u.display_name, ''), u.username) AS display_name, u.avatar,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likes,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
      EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = ?) AS liked
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
  `).get(viewerId, postId);
  if (!post) return null;
  const comments = db.prepare(`
    SELECT c.id, c.content, c.created_at, u.username, u.avatar,
      EXISTS(SELECT 1 FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = ?) AS liked
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.post_id = ? ORDER BY c.created_at DESC LIMIT 5
  `).all(viewerId, postId).reverse();
  const shareCount = db.prepare("SELECT COUNT(*) AS count FROM shares WHERE post_id = ?").get(postId).count;
  return {
    id: post.id,
    userId: post.user_id,
    name: post.display_name,
    handle: `@${post.username.toLowerCase().replace(/[^a-z0-9_.]/g, "")}`,
    avatar: post.avatar,
    time: relativeTime(post.created_at),
    content: post.content,
    image: post.image,
    imageAlt: post.image ? `Photo shared by ${post.display_name}` : "",
    likes: post.likes,
    liked: Boolean(post.liked),
    shares: shareCount,
    comments: comments.map((comment) => ({
      id: comment.id,
      name: comment.username,
      avatar: comment.avatar,
      text: comment.content,
      liked: Boolean(comment.liked),
    })),
    commentCount: post.comment_count,
    topic: creatorCategories[post.user_id] || "Community",
  };
}

function postList(viewerId, ownerId = null, followingOnly = false, likedOnly = false) {
  let rows;
  if (ownerId) {
    rows = db.prepare("SELECT id FROM posts WHERE user_id = ? ORDER BY created_at DESC").all(ownerId);
  } else if (likedOnly) {
    rows = db.prepare(`
      SELECT p.id FROM posts p JOIN likes l ON l.post_id = p.id
      WHERE l.user_id = ? ORDER BY p.created_at DESC
    `).all(viewerId);
  } else if (followingOnly) {
    rows = db.prepare(`
      SELECT p.id FROM posts p
      WHERE p.user_id = ? OR p.user_id IN (SELECT followed_id FROM follows WHERE follower_id = ?)
      ORDER BY p.created_at DESC
    `).all(viewerId, viewerId);
  } else {
    rows = db.prepare("SELECT id FROM posts ORDER BY created_at DESC").all();
  }
  return rows.map((row) => postPayload(row.id, viewerId)).filter(Boolean);
}

function notificationPayload(row) {
  const actor = getUserById(row.actor_id);
  return {
    id: row.id,
    type: row.type,
    category: row.type === "like" ? "likes" : row.type === "comment" ? "comments" : row.type === "follow" ? "follows" : "mentions",
    actor: actor.display_name || actor.username,
    handle: `@${actor.username.toLowerCase().replace(/[^a-z0-9_.]/g, "")}`,
    avatar: actor.avatar,
    message: row.type === "like" ? "liked your post." : row.type === "comment" ? "commented on your post." : row.type === "follow" ? "started following you." : "mentioned you in a post.",
    detail: row.detail,
    time: relativeTime(row.created_at),
    unread: !row.read_at,
    href: row.type === "follow" ? "/profile" : row.post_id ? `/home#${row.post_id}` : "/notifications",
  };
}

function messageTime(value) {
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function getConversations(userId) {
  const contacts = db.prepare("SELECT * FROM users WHERE id != ? ORDER BY is_demo DESC, username COLLATE NOCASE").all(userId);
  return contacts.map((contact) => {
    const messages = db.prepare(`
      SELECT * FROM messages
      WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
      ORDER BY created_at ASC
    `).all(userId, contact.id, contact.id, userId);
    return {
      id: contact.id,
      name: contact.display_name || contact.username,
      handle: `@${contact.username.toLowerCase().replace(/[^a-z0-9_.]/g, "")}`,
      avatar: contact.avatar,
      online: Boolean(contact.is_demo),
      unread: messages.filter((message) => message.recipient_id === userId && !message.read_at).length,
      messages: messages.map((message) => ({
        id: message.id,
        from: message.sender_id === userId ? "me" : "them",
        text: message.content,
        image: message.image,
        time: messageTime(message.created_at),
        read: Boolean(message.read_at),
      })),
    };
  }).sort((left, right) => {
    const leftTime = left.messages.length ? left.messages[left.messages.length - 1].time : "";
    const rightTime = right.messages.length ? right.messages[right.messages.length - 1].time : "";
    return rightTime.localeCompare(leftTime) || left.name.localeCompare(right.name);
  });
}

async function createPasswordHash(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 64);
  return `scrypt:${salt}:${Buffer.from(derived).toString("hex")}`;
}

async function verifyPassword(password, stored) {
  if (!stored) return false;
  const [scheme, salt, expectedHex] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !expectedHex) return false;
  const actual = Buffer.from(await scryptAsync(password, salt, 64));
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function issueSession(userId, res) {
  const token = randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
    hashToken(token),
    userId,
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  );
  res.setHeader("Set-Cookie", [sessionCookie(token), accountSessionCookie(userId, token)]);
}

function checkOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;
  const expected = process.env.FRONTEND_ORIGIN;
  if (expected && origin === expected) return;
  const allowed = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);
  if (process.env.NODE_ENV !== "production" && allowed.has(origin)) return;
  const url = new URL(origin);
  if (url.host === req.headers.host) return;
  throw new ApiError(403, "Request origin is not allowed.");
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (!req.url.startsWith("/api/")) {
    serveFrontend(req, res, url);
    return;
  }
  if (req.method === "OPTIONS") {
    res.writeHead(204, { Allow: "GET, POST, PATCH, PUT, DELETE, OPTIONS" });
    res.end();
    return;
  }
  if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) checkOrigin(req);

  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = req.method;

  if (path === "/api/health" && method === "GET") {
    send(res, 200, { status: "ok" });
    return;
  }

  if (path === "/api/auth/signup" && method === "POST") {
    const body = await readJson(req);
    const username = requireString(body.username, "Username", 30);
    const email = requireString(body.email, "Email", 254).toLowerCase();
    const password = requireString(body.password, "Password", 200);
    if (!/^[a-zA-Z0-9_. -]{2,30}$/.test(username)) throw new ApiError(400, "Username must be 2–30 letters, numbers, spaces, dots, or underscores.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "Enter a valid email address.");
    if (password.length < 8) throw new ApiError(400, "Password must be at least 8 characters.");
    const userId = makeId();
    const userSlug = username.toLowerCase().replace(/[^a-z0-9_.]/g, "");
    if (!userSlug) throw new ApiError(400, "Username must include letters or numbers.");
    const passwordHash = await createPasswordHash(password);
    try {
      db.prepare(`
        INSERT INTO users (id, email, username, display_name, password_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, email, username, username, passwordHash, now());
    } catch (error) {
      if (String(error.message).includes("UNIQUE")) throw new ApiError(409, "That email or username is already registered.");
      throw error;
    }
    send(res, 201, { user: publicUser(getUserById(userId)) });
    return;
  }

  if (path === "/api/auth/login" && method === "POST") {
    const body = await readJson(req);
    const email = requireString(body.email, "Email", 254).toLowerCase();
    const password = requireString(body.password, "Password", 200);
    const user = db.prepare("SELECT * FROM users WHERE email = ? COLLATE NOCASE").get(email);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      throw new ApiError(401, "Invalid email or password.");
    }
    issueSession(user.id, res);
    send(res, 200, { user: publicUser(user) });
    return;
  }

  if (path === "/api/auth/switch" && method === "POST") {
    const body = await readJson(req);
    const userId = requireString(body.userId, "Account", 100);
    const token = parseCookies(req)[accountCookieName(userId)];
    if (!token) throw new ApiError(401, "This account is no longer saved on this device. Please log in.");
    const session = db.prepare(`
      SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?
    `).get(hashToken(token), now());
    if (!session || session.user_id !== userId) {
      throw new ApiError(401, "This account session expired. Please log in again.");
    }
    const user = getUserById(userId);
    if (!user) throw new ApiError(401, "This account is not available.");
    setSessionCookie(res, token);
    send(res, 200, { user: publicUser(user) });
    return;
  }

  if (path === "/api/auth/leave" && method === "POST") {
    clearSessionCookie(res);
    send(res, 200, { ok: true });
    return;
  }

  if (path === "/api/auth/forget" && method === "POST") {
    const body = await readJson(req);
    const userId = requireString(body.userId, "Account", 100);
    const cookieName = accountCookieName(userId);
    const token = parseCookies(req)[cookieName];
    if (token) {
      db.prepare("DELETE FROM sessions WHERE token_hash = ? AND user_id = ?").run(hashToken(token), userId);
    }
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.setHeader("Set-Cookie", `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
    send(res, 200, { ok: true });
    return;
  }

  if (path === "/api/auth/logout" && method === "POST") {
    const token = parseCookies(req).vyntra_session;
    const session = token
      ? db.prepare("SELECT user_id FROM sessions WHERE token_hash = ?").get(hashToken(token))
      : null;
    if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
    clearSessionCookie(res, session?.user_id);
    send(res, 200, { ok: true });
    return;
  }

  if (path === "/api/auth/me" && method === "GET") {
    const user = currentUser(req);
    setAccountSessionCookie(res, user.id, parseCookies(req).vyntra_session);
    send(res, 200, { user: publicUser(user) });
    return;
  }

  const user = currentUser(req);

  if (path === "/api/profile/me" && method === "GET") {
    const counts = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM posts WHERE user_id = ?) AS posts,
        (SELECT COUNT(*) FROM follows WHERE followed_id = ?) AS followers,
        (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS following
    `).get(user.id, user.id, user.id);
    send(res, 200, {
      profile: publicUser(user),
      stats: counts,
      posts: postList(user.id, user.id),
      likedPosts: postList(user.id, null, false, true),
    });
    return;
  }

  if (path === "/api/profile" && method === "PATCH") {
    const body = await readJson(req);
    const name = requireString(body.name, "Name", 50);
    const username = requireString(body.username, "Username", 30);
    const handle = username.toLowerCase().replace(/[^a-z0-9_.]/g, "");
    if (!/^[a-zA-Z0-9_. -]{2,30}$/.test(username) || !handle) throw new ApiError(400, "Username must be 2–30 letters, numbers, spaces, dots, or underscores.");
    const bio = requireString(body.bio ?? "", "Bio", 180, true);
    const location = requireString(body.location ?? "", "Location", 60, true);
    const website = requireString(body.website ?? "", "Website", 100, true);
    const avatar = body.avatar ? validateImage(body.avatar) : requireString(body.avatar ?? "", "Profile photo", 5_600_000, true);
    const cover = body.cover ? validateImage(body.cover) : requireString(body.cover ?? "", "Cover photo", 5_600_000, true);
    try {
      db.prepare(`
        UPDATE users SET username = ?, display_name = ?, bio = ?, location = ?, website = ?, avatar = ?, cover = ?
        WHERE id = ?
      `).run(username, name, bio, location, website, avatar, cover, user.id);
    } catch (error) {
      if (String(error.message).includes("UNIQUE")) throw new ApiError(409, "That username is already in use.");
      throw error;
    }
    send(res, 200, { profile: publicUser(getUserById(user.id)) });
    return;
  }

  if (path === "/api/posts" && method === "GET") {
    send(res, 200, { posts: postList(user.id, null, url.searchParams.get("feed") === "following") });
    return;
  }

  if (path === "/api/posts" && method === "POST") {
    const body = await readJson(req);
    const content = requireString(body.content ?? "", "Post", 2000, true);
    const image = validateImage(body.image);
    if (!content && !image) throw new ApiError(400, "Write something or add a photo before posting.");
    const id = makeId();
    db.prepare("INSERT INTO posts (id, user_id, content, image, created_at) VALUES (?, ?, ?, ?, ?)").run(id, user.id, content, image, now());
    send(res, 201, { post: postPayload(id, user.id) });
    return;
  }

  let match = path.match(/^\/api\/posts\/([^/]+)$/);
  if (match && method === "DELETE") {
    const result = db.prepare("DELETE FROM posts WHERE id = ? AND user_id = ?").run(match[1], user.id);
    if (!result.changes) throw new ApiError(404, "Post not found or not yours to delete.");
    send(res, 200, { ok: true });
    return;
  }

  match = path.match(/^\/api\/posts\/([^/]+)\/like$/);
  if (match && ["PUT", "DELETE"].includes(method)) {
    const post = db.prepare("SELECT user_id FROM posts WHERE id = ?").get(match[1]);
    if (!post) throw new ApiError(404, "Post not found.");
    if (method === "PUT") {
      db.prepare("INSERT OR IGNORE INTO likes (user_id, post_id, created_at) VALUES (?, ?, ?)").run(user.id, match[1], now());
      notify(post.user_id, user.id, "like", match[1]);
    } else {
      db.prepare("DELETE FROM likes WHERE user_id = ? AND post_id = ?").run(user.id, match[1]);
    }
    send(res, 200, { post: postPayload(match[1], user.id) });
    return;
  }

  match = path.match(/^\/api\/posts\/([^/]+)\/share$/);
  if (match && method === "POST") {
    const post = db.prepare("SELECT id FROM posts WHERE id = ?").get(match[1]);
    if (!post) throw new ApiError(404, "Post not found.");
    db.prepare("INSERT OR IGNORE INTO shares (user_id, post_id, created_at) VALUES (?, ?, ?)").run(user.id, match[1], now());
    send(res, 200, { post: postPayload(match[1], user.id) });
    return;
  }

  match = path.match(/^\/api\/posts\/([^/]+)\/comments$/);
  if (match && method === "POST") {
    const post = db.prepare("SELECT user_id FROM posts WHERE id = ?").get(match[1]);
    if (!post) throw new ApiError(404, "Post not found.");
    const body = await readJson(req);
    const content = requireString(body.content, "Comment", 1000);
    const id = makeId();
    db.prepare("INSERT INTO comments (id, user_id, post_id, content, created_at) VALUES (?, ?, ?, ?, ?)").run(id, user.id, match[1], content, now());
    notify(post.user_id, user.id, "comment", match[1], id, content);
    send(res, 201, { post: postPayload(match[1], user.id) });
    return;
  }

  match = path.match(/^\/api\/comments\/([^/]+)\/like$/);
  if (match && ["PUT", "DELETE"].includes(method)) {
    const comment = db.prepare("SELECT id FROM comments WHERE id = ?").get(match[1]);
    if (!comment) throw new ApiError(404, "Comment not found.");
    if (method === "PUT") db.prepare("INSERT OR IGNORE INTO comment_likes (user_id, comment_id) VALUES (?, ?)").run(user.id, match[1]);
    else db.prepare("DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?").run(user.id, match[1]);
    send(res, 200, { ok: true });
    return;
  }

  if (path === "/api/follows/lists" && method === "GET") {
    const followers = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar, u.bio
      FROM follows f JOIN users u ON u.id = f.follower_id
      WHERE f.followed_id = ?
      ORDER BY f.created_at DESC
    `).all(user.id).map((row) => ({
      id: row.id,
      name: row.display_name || row.username,
      username: row.username,
      handle: `@${row.username.toLowerCase().replace(/[^a-z0-9_.]/g, "")}`,
      avatar: row.avatar,
      bio: row.bio,
    }));
    const following = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar, u.bio
      FROM follows f JOIN users u ON u.id = f.followed_id
      WHERE f.follower_id = ?
      ORDER BY f.created_at DESC
    `).all(user.id).map((row) => ({
      id: row.id,
      name: row.display_name || row.username,
      username: row.username,
      handle: `@${row.username.toLowerCase().replace(/[^a-z0-9_.]/g, "")}`,
      avatar: row.avatar,
      bio: row.bio,
    }));
    send(res, 200, { followers, following });
    return;
  }

  if (path === "/api/follows" && method === "GET") {
    const follows = db.prepare("SELECT followed_id FROM follows WHERE follower_id = ?").all(user.id).map((row) => row.followed_id);
    send(res, 200, { follows });
    return;
  }

  match = path.match(/^\/api\/users\/([^/]+)\/follow$/);
  if (match && ["PUT", "DELETE"].includes(method)) {
    const target = getUserById(match[1]);
    if (!target) throw new ApiError(404, "User not found.");
    if (target.id === user.id) throw new ApiError(400, "You cannot follow yourself.");
    if (method === "PUT") {
      db.prepare("INSERT OR IGNORE INTO follows (follower_id, followed_id, created_at) VALUES (?, ?, ?)").run(user.id, target.id, now());
      notify(target.id, user.id, "follow");
    } else {
      db.prepare("DELETE FROM follows WHERE follower_id = ? AND followed_id = ?").run(user.id, target.id);
    }
    send(res, 200, { following: method === "PUT" });
    return;
  }

  if (path === "/api/explore" && method === "GET") {
    const query = (url.searchParams.get("query") || "").trim().slice(0, 80).toLowerCase();
    const category = (url.searchParams.get("category") || "").trim().slice(0, 40);
    const following = new Set(db.prepare("SELECT followed_id FROM follows WHERE follower_id = ?").all(user.id).map((row) => row.followed_id));
    const users = db.prepare("SELECT * FROM users WHERE id != ? ORDER BY is_demo DESC, username COLLATE NOCASE").all(user.id)
      .map((row) => {
        const followerCount = db.prepare("SELECT COUNT(*) AS count FROM follows WHERE followed_id = ?").get(row.id).count;
        return {
          ...publicUser(row),
          followers: followerCount,
          category: creatorCategories[row.id] || "Community",
          following: following.has(row.id),
        };
      })
      .filter((item) => `${item.name} ${item.handle} ${item.bio} ${item.category}`.toLowerCase().includes(query))
      .filter((item) => !category || category === "All" || item.category === category || category === "Community");
    const posts = postList(user.id).filter((post) => `${post.content} ${post.name} ${post.handle} ${post.topic}`.toLowerCase().includes(query));
    const topicCounts = new Map();
    for (const post of postList(user.id)) {
      for (const tag of post.content.match(/#[\p{L}\d_]+/gu) || []) {
        const topic = topicCounts.get(tag) || { tag, category: post.topic, count: 0 };
        topic.count += 1;
        topicCounts.set(tag, topic);
      }
    }
    const topics = [...topicCounts.values()]
      .filter((topic) => !query || `${topic.tag} ${topic.category}`.toLowerCase().includes(query))
      .filter((topic) => !category || category === "All" || topic.category === category)
      .sort((left, right) => right.count - left.count)
      .map((topic, index) => ({
        tag: topic.tag,
        posts: `${topic.count} ${topic.count === 1 ? "post" : "posts"}`,
        category: topic.category,
        color: ["rose", "violet", "peach", "green", "blue"][index % 5],
      }));
    send(res, 200, { creators: users, posts, topics });
    return;
  }

  if (path === "/api/messages" && method === "GET") {
    send(res, 200, { conversations: getConversations(user.id) });
    return;
  }

  match = path.match(/^\/api\/messages\/([^/]+)\/read$/);
  if (match && method === "PATCH") {
    db.prepare("UPDATE messages SET read_at = ? WHERE recipient_id = ? AND sender_id = ? AND read_at IS NULL").run(now(), user.id, match[1]);
    send(res, 200, { ok: true });
    return;
  }

  match = path.match(/^\/api\/messages\/([^/]+)$/);
  if (match && method === "POST") {
    const recipient = getUserById(match[1]);
    if (!recipient) throw new ApiError(404, "Recipient not found.");
    if (recipient.id === user.id) throw new ApiError(400, "You cannot message yourself.");
    const body = await readJson(req);
    const content = requireString(body.content ?? "", "Message", 2000, true);
    const image = validateImage(body.image);
    if (!content && !image) throw new ApiError(400, "Write a message or attach a photo.");
    const id = makeId();
    db.prepare("INSERT INTO messages (id, sender_id, recipient_id, content, image, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, user.id, recipient.id, content, image, now());
    send(res, 201, { message: { id, from: "me", text: content, image, time: messageTime(now()), read: false } });
    return;
  }

  match = path.match(/^\/api\/messages\/([^/]+)\/delete$/);
  if (match && method === "DELETE") {
    const result = db.prepare("DELETE FROM messages WHERE id = ? AND sender_id = ?").run(match[1], user.id);
    if (!result.changes) throw new ApiError(404, "Message not found or not yours to delete.");
    send(res, 200, { ok: true });
    return;
  }

  if (path === "/api/notifications" && method === "GET") {
    const rows = db.prepare("SELECT * FROM notifications WHERE recipient_id = ? ORDER BY created_at DESC LIMIT 100").all(user.id);
    send(res, 200, { notifications: rows.map(notificationPayload) });
    return;
  }

  match = path.match(/^\/api\/notifications\/([^/]+)\/read$/);
  if (match && method === "PATCH") {
    db.prepare("UPDATE notifications SET read_at = ? WHERE id = ? AND recipient_id = ?").run(now(), match[1], user.id);
    send(res, 200, { ok: true });
    return;
  }

  if (path === "/api/notifications/read-all" && method === "POST") {
    db.prepare("UPDATE notifications SET read_at = ? WHERE recipient_id = ? AND read_at IS NULL").run(now(), user.id);
    send(res, 200, { ok: true });
    return;
  }

  match = path.match(/^\/api\/notifications\/([^/]+)$/);
  if (match && method === "DELETE") {
    db.prepare("DELETE FROM notifications WHERE id = ? AND recipient_id = ?").run(match[1], user.id);
    send(res, 200, { ok: true });
    return;
  }

  if (path === "/api/notifications" && method === "DELETE") {
    db.prepare("DELETE FROM notifications WHERE recipient_id = ?").run(user.id);
    send(res, 200, { ok: true });
    return;
  }

  throw new ApiError(404, "API endpoint not found.");
}

const server = createServer((req, res) => {
  handle(req, res).catch((error) => {
    if (!(error instanceof ApiError)) console.error(error);
    if (res.headersSent) {
      res.destroy();
      return;
    }
    send(res, error.status || 500, {
      error: error.status ? error.message : "An unexpected server error occurred.",
    });
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Vyntra server listening on port ${port}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

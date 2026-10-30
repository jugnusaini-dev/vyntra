# Vyntra

Vyntra is a React social app with a local Node.js HTTP API and SQLite database.
The API uses Node's built-in HTTP and SQLite modules rather than Express or a
third-party database package.

## Requirements

- Node.js 22.5 or newer (`node:sqlite` is built into Node).
- npm

## Run locally

Install the client dependencies once:

```sh
npm install
```

Start the API and React development server in two terminals:

```sh
npm run server
```

```sh
npm start
```

Open [http://localhost:3000](http://localhost:3000). The SQLite database is
created at `data/vyntra.sqlite` and is intentionally excluded from Git. Set
`VYNTRA_DB_PATH` to use another database file.

Create an account at `/signup`. Passwords are stored as scrypt hashes, and
login sessions are kept in HttpOnly cookies. Up to three account names can be
remembered on this device for quick switching; passwords are never stored in
the browser. Use the account menu to switch accounts, add another account, or
log out. Logging out revokes the current account's saved session. The API seeds
a small set of demo creators and posts so the feed is useful on a new
installation. Demo accounts can be followed and messaged, but do not sign in.

Profile data, posts, likes, comments, follows, messages, and notifications are
stored in SQLite. Uploaded images are kept as data URLs in the database; the
API accepts images up to 4 MB.

## Production deployment

```sh
npm run build
npm run start:production
```

Configure the hosting provider to run `npm run build` as its build command and
`npm run start:production` as its start command. The server serves both the
React app and `/api` routes on the same origin and listens on the port supplied
by the host. Set `VYNTRA_DB_PATH` to a writable persistent disk location so
accounts and app data survive restarts and deployments. Use a host that
supports Node.js 22.5 or newer and persistent storage for SQLite.

Deploy behind HTTPS and set `FRONTEND_ORIGIN` to the exact public site origin
when the host requires explicit origin validation.

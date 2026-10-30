import { Link, useLocation } from "react-router-dom";
import "../Login.css";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../api";
import { forgetAccount, getSavedAccounts } from "../auth/savedAccounts";

function Login({ onAuthenticated }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [savedAccounts, setSavedAccounts] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    try {
      setSavedAccounts(getSavedAccounts());
    } catch (accountError) {
      setError(`Could not load saved accounts: ${accountError.message}`);
    }
  }, []);

  useEffect(() => {
    if (location.state?.email) setEmail(location.state.email);
  }, [location.state?.email]);

  async function handal(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const { user } = await api.login({ email, password });
      onAuthenticated(user);
      navigate("/home");
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const chooseAccount = async (account) => {
    setEmail(account.email);
    setPassword("");
    setError("");
    setIsSubmitting(true);
    try {
      const { user } = await api.switchAccount(account.id);
      onAuthenticated(user);
      navigate("/home");
    } catch (switchError) {
      if (switchError.status === 401) {
        setError("This account needs its password again. Enter it below to sign in.");
      } else {
        setError(switchError.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeAccount = async (account) => {
    try {
      await api.forgetSavedAccount(account.id);
      forgetAccount(account.email);
      setSavedAccounts(getSavedAccounts());
      if (email.toLowerCase() === account.email.toLowerCase()) {
        setEmail("");
        setPassword("");
      }
    } catch (accountError) {
      setError(`Could not remove this saved account: ${accountError.message}`);
    }
  };

  return (
    <main className="login-container">
      <section className="login-card" aria-label="Vyntra login">
        <div className="login-form">
          <h1>Welcome Back!</h1>
          <p className="login-intro">Login to continue your Vyntra journey.</p>
          {location.state?.message && (
            <p className="auth-success" role="status">{location.state.message}</p>
          )}

          {savedAccounts.length > 0 && (
            <section className="saved-accounts" aria-label="Saved accounts">
              <h2>Switch account</h2>
              <p>Tap an account to switch. Passwords are never saved on this device.</p>
              <ul>
                {savedAccounts.map((account) => (
                  <li key={account.email}>
                    <button
                      className={`saved-account${email.toLowerCase() === account.email.toLowerCase() ? " selected" : ""}`}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => chooseAccount(account)}
                    >
                      <span className="saved-account-avatar" aria-hidden="true">
                        {account.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="saved-account-details">
                        <strong>{account.name}</strong>
                        <span>{account.email}</span>
                      </span>
                      <span className="saved-account-switch-label">Switch</span>
                    </button>
                    <button
                      className="forget-account"
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => removeAccount(account)}
                      aria-label={`Remove ${account.name} from saved accounts`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <form onSubmit={handal}>
            <label htmlFor="login-email">Email Address</label>
            <input
              type="email"
              id="login-email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
              required
            />

            <label htmlFor="login-password">Password</label>
            <input
              type="password"
              id="login-password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />

            <div className="login-options">
              <span className="login-remember-note">Account names only are saved here.</span>
              <a href="#forgot-password">Forgot Password?</a>
            </div>

            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="login-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Login"}
            </button>
          </form>

          <p className="signup-text">
            Don&apos;t have an account? <Link to="/signup">Sign Up</Link>
          </p>
        </div>

        <aside className="welcome-section">
          <h2>Vyntra</h2>
          <h3>Your Voice. Your World.</h3>
          <p>
            Connect with people, share your thoughts, and discover conversations
            that matter.
          </p>
        </aside>
      </section>
    </main>
  );
}

export default Login;

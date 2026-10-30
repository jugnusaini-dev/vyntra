import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

function Signup() {
  const navigate = useNavigate();

  const [username, setusername] = useState("");
  const [email, setemail] = useState("");
  const [password, setpassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handal(event) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      await api.signup({ username, email, password });
      navigate("/login", { state: { message: "Account created. Please log in." } });
    } catch (signupError) {
      setError(signupError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="signup-page">
      <section className="signup-card" aria-label="Create a Vyntra account">
        <aside className="signup-welcome">
          <h1>Vyntra</h1>
          <h2>Hello, Friend!</h2>
          <p>Enter your details and start your journey with us.</p>
        </aside>

        <div className="signup-form-panel">
          <h2>Create Your Account</h2>
          <p className="signup-intro">Join Vyntra and make your voice heard.</p>

          <form className="signup-form" onSubmit={handal}>
            <div className="signup-field">
              <label htmlFor="signup-username">Username</label>
              <input
                type="text"
                id="signup-username"
                name="username"
                value={username}
                onChange={(e) => setusername(e.target.value)}
                minLength={2}
                maxLength={30}
                placeholder="Enter your username"
                autoComplete="username"
                required
              />
            </div>

            <div className="signup-field">
              <label htmlFor="signup-email">Email Address</label>
              <input
                type="email"
                id="signup-email"
                name="email"
                value={email}
                onChange={(e) => setemail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                required
              />
            </div>

            <div className="signup-field">
              <label htmlFor="signup-password">Password</label>
              <input
                type="password"
                id="signup-password"
                name="password"
                value={password}
                onChange={(e) => setpassword(e.target.value)}
                minLength={8}
                maxLength={200}
                placeholder="Create a password"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="signup-field">
              <label htmlFor="signup-confirm-password">Confirm Password</label>
              <input
                type="password"
                id="signup-confirm-password"
                name="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                autoComplete="new-password"
                required
              />
            </div>

            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating account..." : "Create Account"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

export default Signup;

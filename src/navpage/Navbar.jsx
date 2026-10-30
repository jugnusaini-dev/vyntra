import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  Compass,
  MessageCircle,
  Bell,
  UserRound,
  Menu,
  X,
  ChevronDown,
  LogOut,
  Plus,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { getSavedAccounts } from "../auth/savedAccounts";
import "./Navbar.css";

function Navbar() {
  const { currentUser, logout, addAccount, switchAccount, accountStorageError } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState([]);
  const [logoutError, setLogoutError] = useState("");

  useEffect(() => {
    try {
      setSavedAccounts(getSavedAccounts());
    } catch (error) {
      setLogoutError(`Could not load saved accounts: ${error.message}`);
    }
  }, []);

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = async (destination) => {
    setLogoutError("");
    try {
      await logout();
      setAccountMenuOpen(false);
      closeMenu();
      navigate(destination);
    } catch (error) {
      setLogoutError(error.message);
    }
  };

  const handleAddAccount = async () => {
    setLogoutError("");
    try {
      await addAccount();
      setAccountMenuOpen(false);
      navigate("/login", { state: { message: "Sign in to add another account." } });
    } catch (error) {
      setLogoutError(error.message);
    }
  };

  const handleSwitchAccount = async (account) => {
    setLogoutError("");
    try {
      await switchAccount(account.id);
      window.location.assign("/home");
    } catch (error) {
      if (error.status === 401) {
        try {
          await addAccount();
          navigate("/login", {
            state: {
              email: account.email,
              message: "Enter this account's password to restore its saved session.",
            },
          });
          return;
        } catch (leaveError) {
          setLogoutError(leaveError.message);
          return;
        }
      }
      setLogoutError(error.message);
    }
  };

  return (
    <header className="vyntra-navbar">
      <div className="navbar-container">
        <Link to="/home" className="navbar-logo" onClick={closeMenu}>
          <span className="logo-icon">V</span>
          <span>Vyntra</span>
        </Link>

        <nav className={`navbar-links ${menuOpen ? "active" : ""}`}>
          <NavLink to="/home" onClick={closeMenu}>
            <Home size={19} />
            <span>Home</span>
          </NavLink>

          <NavLink to="/explore" onClick={closeMenu}>
            <Compass size={19} />
            <span>Explore</span>
          </NavLink>

          <NavLink to="/messages" onClick={closeMenu}>
            <MessageCircle size={19} />
            <span>Messages</span>
          </NavLink>

          <NavLink to="/notifications" onClick={closeMenu}>
            <Bell size={19} />
            <span>Notifications</span>
          </NavLink>

          <NavLink to="/profile" onClick={closeMenu}>
            <UserRound size={19} />
            <span>Profile</span>
          </NavLink>
        </nav>

        <div className="navbar-account">
          <button
            className="navbar-account-toggle"
            type="button"
            onClick={() => setAccountMenuOpen(!accountMenuOpen)}
            aria-expanded={accountMenuOpen}
            aria-haspopup="menu"
          >
            <span className="navbar-account-avatar">
              {(currentUser?.name || currentUser?.username || "A").charAt(0).toUpperCase()}
            </span>
            <span className="navbar-account-name">
              {currentUser?.name || currentUser?.username || "Account"}
            </span>
            <ChevronDown size={16} />
          </button>
          {accountMenuOpen && (
            <div className="navbar-account-menu" role="menu">
              <p className="navbar-account-identity">
                Signed in as <strong>{currentUser?.email}</strong>
              </p>
              <p className="navbar-account-section-title">Switch account</p>
              {savedAccounts
                .filter((account) => account.id !== currentUser?.id)
                .map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    role="menuitem"
                    onClick={() => handleSwitchAccount(account)}
                  >
                    <span className="navbar-account-avatar small">
                      {account.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="navbar-saved-account">
                      <strong>{account.name}</strong>
                      <span>{account.email}</span>
                    </span>
                  </button>
                ))}
              <button
                type="button"
                role="menuitem"
                onClick={handleAddAccount}
              >
                <Plus size={17} />
                Add account
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleLogout("/login")}
              >
                <LogOut size={17} />
                Log out
              </button>
              {accountStorageError && (
                <p className="navbar-logout-error" role="alert">{accountStorageError}</p>
              )}
              {logoutError && <p className="navbar-logout-error" role="alert">{logoutError}</p>}
            </div>
          )}
        </div>

        <button
          className="menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={25} /> : <Menu size={25} />}
        </button>
      </div>
    </header>
  );
}

export default Navbar;

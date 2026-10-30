
import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { api } from "./api";
import Signup from "./signup/Signup";
import Login from "./signup/Login";
import Home from "./Home";
import Explore from "./Explore";
import Messages from "./Messages";
import Notifications from "./Notifications";
import Profile from "./Profile";
import { AuthProvider } from "./auth/AuthContext";
import { forgetAccount, saveAccount } from "./auth/savedAccounts";

function AuthRoute({ children, isAuthenticated, guestOnly = false }) {
  if (isAuthenticated === null) {
    return <p role="status">Preparing your account...</p>;
  }

  if (guestOnly) {
    return isAuthenticated ? <Navigate to="/home" replace /> : children;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function App() {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [startupError, setStartupError] = useState("");
  const [accountStorageError, setAccountStorageError] = useState("");

  const rememberCurrentAccount = useCallback((user) => {
    try {
      const evictedAccountIds = saveAccount(user);
      setAccountStorageError("");
      evictedAccountIds.forEach(async (userId) => {
        try {
          await api.forgetSavedAccount(userId);
        } catch (error) {
          setAccountStorageError(`Could not expire an older saved account: ${error.message}`);
        }
      });
    } catch (error) {
      setAccountStorageError(`Could not save this account for switching: ${error.message}`);
    }
  }, []);

  useEffect(() => {
    let isActive = true;
    api.me()
      .then(({ user }) => {
        if (isActive) {
          rememberCurrentAccount(user);
          setCurrentUser(user);
          setIsAuthenticated(true);
          setSessionChecked(true);
        }
      })
      .catch((error) => {
        if (!isActive) return;
        if (error.status === 401) {
          setCurrentUser(null);
          setIsAuthenticated(false);
          setSessionChecked(true);
          return;
        }
        setStartupError(error.message);
      });
    return () => {
      isActive = false;
    };
  }, [rememberCurrentAccount]);

  const handleAuthenticated = (user) => {
    rememberCurrentAccount(user);
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await api.logout();
    if (currentUser) {
      try {
        forgetAccount(currentUser.email);
      } catch (error) {
        setAccountStorageError(`Could not remove this account from saved accounts: ${error.message}`);
      }
    }
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  const handleAddAccount = async () => {
    await api.leaveAccount();
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  const handleSwitchAccount = async (userId) => {
    const { user } = await api.switchAccount(userId);
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  if (startupError) {
    return <p role="alert">Could not prepare your login session: {startupError}</p>;
  }

  if (!sessionChecked) {
    return <p role="status">Preparing login...</p>;
  }

  return (
    <AuthProvider value={{
      currentUser,
      logout: handleLogout,
      addAccount: handleAddAccount,
      switchAccount: handleSwitchAccount,
      accountStorageError,
    }}>
      <Routes>
        <Route path="/" element={<Navigate to="/signup" replace />} />
        <Route
          path="/signup"
          element={
            <AuthRoute isAuthenticated={isAuthenticated} guestOnly>
              <Signup />
            </AuthRoute>
          }
        />
        <Route
          path="/login"
          element={
            <AuthRoute isAuthenticated={isAuthenticated} guestOnly>
              <Login onAuthenticated={handleAuthenticated} />
            </AuthRoute>
          }
        />
        <Route
          path="/home"
          element={<AuthRoute isAuthenticated={isAuthenticated}><Home /></AuthRoute>}
        />
        <Route
          path="/explore"
          element={<AuthRoute isAuthenticated={isAuthenticated}><Explore /></AuthRoute>}
        />
        <Route
          path="/messages"
          element={<AuthRoute isAuthenticated={isAuthenticated}><Messages /></AuthRoute>}
        />
        <Route
          path="/notifications"
          element={<AuthRoute isAuthenticated={isAuthenticated}><Notifications /></AuthRoute>}
        />
        <Route
          path="/profile"
          element={<AuthRoute isAuthenticated={isAuthenticated}><Profile /></AuthRoute>}
        />
        <Route path="*" element={<Navigate to="/signup" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;

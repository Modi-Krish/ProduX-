import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCurrentUser, restoreCredentials } from './features/auth/authSlice';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Social from './pages/Social';
import WalkieDashboard from './pages/WalkieDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import PinProtection from './components/PinProtection';
import { auth } from './api/firebase';
import { onIdTokenChanged } from 'firebase/auth';
import useFCM from './hooks/useFCM';

function App() {
  const dispatch = useDispatch();
  const { token, user, isInitialized } = useSelector((state) => state.auth);

  // 1. Asynchronously restore session from Capacitor Preferences on app startup
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const tokenRes = await Preferences.get({ key: 'token' });
        const userRes = await Preferences.get({ key: 'user' });
        
        let tokenVal = tokenRes.value;
        let userVal = null;

        if (userRes.value) {
          try {
            userVal = JSON.parse(userRes.value);
          } catch (e) {
            console.error('Failed to parse user from Preferences:', e);
          }
        }

        // Fallback to localStorage if Preferences are empty (e.g., first boot or web)
        if (!tokenVal) {
          tokenVal = localStorage.getItem('token');
          const localUser = localStorage.getItem('user');
          if (localUser) {
            try {
              userVal = JSON.parse(localUser);
            } catch (e) {}
          }
        }

        dispatch(restoreCredentials({ token: tokenVal, user: userVal }));
      } catch (err) {
        console.error('Error restoring persistent session:', err);
        dispatch(restoreCredentials({ token: null, user: null }));
      }
    };

    restoreSession();
  }, [dispatch]);

  // 2. Synchronize changes to Preferences and fetch profile once initialized
  useEffect(() => {
    if (!isInitialized) return;

    if (token) {
      dispatch(fetchCurrentUser());
      Preferences.set({ key: 'token', value: token });
      if (user) {
        Preferences.set({ key: 'user', value: JSON.stringify(user) });
      } else {
        Preferences.remove({ key: 'user' });
      }
    } else {
      Preferences.remove({ key: 'token' });
      Preferences.remove({ key: 'user' });
    }
  }, [token, isInitialized, dispatch]); // Removed user from deps to avoid infinite loops if fetchCurrentUser updates user

  // 3. Listen to Firebase Auth for automatic token refresh (prevents 1-hour automatic logouts)
  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const newToken = await firebaseUser.getIdToken();
          // If the token changed, dispatch an update to Redux
          if (newToken && newToken !== token) {
            dispatch(restoreCredentials({ token: newToken, user }));
          }
        } catch (err) {
          console.error('Error refreshing token in background:', err);
        }
      }
    });
    return () => unsubscribe();
  }, [auth, token, user, dispatch]);


  // Request native notification access immediately on app startup
  useEffect(() => {
    const requestPermissionOnStartup = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const permStatus = await LocalNotifications.checkPermissions();
          if (permStatus.display !== 'granted') {
            await LocalNotifications.requestPermissions();
          }
        } catch (err) {
          console.error('Error requesting startup notification permission:', err);
        }
      }
    };
    requestPermissionOnStartup();
  }, []);

  // Register FCM push notification token at the App level
  // so it happens immediately on login, not only when visiting Community.
  useFCM();

  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'toast-custom',
          duration: 3000,
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/social"
          element={
            <ProtectedRoute>
              <PinProtection feature="community">
                <Social />
              </PinProtection>
            </ProtectedRoute>
          }
        />
        <Route
          path="/walkie"
          element={
            <ProtectedRoute>
              <PinProtection feature="walkieTalkie">
                <WalkieDashboard />
              </PinProtection>
            </ProtectedRoute>
          }
        />
        <Route
          path="/walkie/:roomId"
          element={
            <ProtectedRoute>
              <PinProtection feature="walkieTalkie">
                <WalkieDashboard />
              </PinProtection>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;

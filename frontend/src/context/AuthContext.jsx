import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabase.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setCurrentUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth state changes (sign in, sign out, token refreshed)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setCurrentUser(session?.user ?? null);
      setIsLoading(false);
    });

    const handleLogout = async () => {
      try {
        await supabase.auth.signOut();
      } catch {}
      setSession(null);
      setCurrentUser(null);
    };

    window.addEventListener('flux:logout', handleLogout);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('flux:logout', handleLogout);
    };
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    setSession(data.session);
    setCurrentUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setCurrentUser(null);
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) throw error;
  };

  const loginWithPassword = async (password) => {
    let email = import.meta.env.VITE_ADMIN_EMAIL || localStorage.getItem('flux_saved_email');
    if (!email) {
      try {
        const res = await fetch('/api/auth/status');
        const data = await res.json();
        if (data.ownerEmail) {
          email = data.ownerEmail;
        }
      } catch {}
    }
    if (!email) {
      email = 'mayursewatkar237@gmail.com';
    }
    const user = await login(email, password);
    localStorage.setItem('flux_saved_email', email);
    return user;
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        session,
        isAuthenticated: !!currentUser,
        isLoading,
        login,
        loginWithPassword,
        logout,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

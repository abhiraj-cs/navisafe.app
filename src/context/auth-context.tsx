'use client';

import { useRouter } from 'next/navigation';
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AuthContextType {
  isAdmin: boolean;
  login: (user: string, pass: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();

  const login = (user: string, pass: string) => {
    if (user === 'admin' && pass === 'admin@123') {
      setIsAdmin(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAdmin(false);
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

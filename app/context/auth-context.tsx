"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Only set loading to false if not authenticating
    if (status !== "loading") setIsLoading(false);
  }, [status]);

  const login = async () => {
    setIsLoading(true);
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } finally {
      setIsLoading(false); // Will be ignored if redirect happens
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await signOut({ callbackUrl: "/" });
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    user: session?.user,
    isLoading,
    isAuthenticated: !!session,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, getSavedUser, getToken, saveAuth, clearAuth, getCurrentUser } from '../api/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 初始化：检查本地存储的 token
  useEffect(() => {
    const initAuth = async () => {
      const savedUser = getSavedUser();
      const token = getToken();

      if (savedUser && token) {
        // 验证 token 是否有效
        try {
          const freshUser = await getCurrentUser();
          setUser(freshUser);
        } catch {
          // token 无效，清除
          clearAuth();
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const { login: loginApi } = await import('../api/auth');
    const response = await loginApi(username, password);
    saveAuth(response.token, response.user);
    setUser(response.user);
  };

  const register = async (username: string, email: string, password: string) => {
    const { register: registerApi } = await import('../api/auth');
    const response = await registerApi(username, email, password);
    saveAuth(response.token, response.user);
    setUser(response.user);
  };

  const logout = () => {
    clearAuth();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

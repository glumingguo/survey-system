import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as authModule from '../api/auth';
import type { User } from '../api/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, inviteCode?: string) => Promise<any>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
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
      const savedUser = authModule.getSavedUser();
      const token = authModule.getToken();

      if (savedUser && token) {
        // 验证 token 是否有效
        try {
          const freshUser = await authModule.getCurrentUser();
          setUser(freshUser);
        } catch (error) {
          console.warn('Token 验证失败:', error);
          // token 无效，清除
          authModule.clearAuth();
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const response = await authModule.login(username, password);
    authModule.saveAuth(response.token, response.user);
    setUser(response.user);
  };

  const register = async (username: string, email: string, password: string, inviteCode?: string) => {
    const response = await authModule.register(username, email, password, inviteCode);
    // 如果是待审核状态，不保存 auth
    if (response.token) {
      authModule.saveAuth(response.token, response.user);
      setUser(response.user);
    }
    return response;
  };

  const logout = () => {
    authModule.clearAuth();
    setUser(null);
  };

  const updateUser = (userData: Partial<User>) => {
    setUser(prev => {
      const updated = prev ? { ...prev, ...userData } : null;
      if (updated) {
        localStorage.setItem('user', JSON.stringify(updated));
      }
      return updated;
    });
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
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

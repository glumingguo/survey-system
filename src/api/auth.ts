import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  createdAt?: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

// 创建 axios 实例
const api = axios.create({
  baseURL: API_BASE,
});

// 请求拦截器：添加 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：处理 401/403
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// 注册
export const register = async (username: string, email: string, password: string): Promise<AuthResponse> => {
  const response = await api.post('/api/auth/register', { username, email, password });
  return response.data;
};

// 登录
export const login = async (username: string, password: string): Promise<AuthResponse> => {
  const response = await api.post('/api/auth/login', { username, password });
  return response.data;
};

// 获取当前用户信息
export const getCurrentUser = async (): Promise<User> => {
  const response = await api.get('/api/auth/me');
  return response.data;
};

// 修改密码
export const changePassword = async (oldPassword: string, newPassword: string): Promise<void> => {
  await api.put('/api/auth/password', { oldPassword, newPassword });
};

// 保存 token 到本地
export const saveAuth = (token: string, user: User) => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
};

// 获取本地保存的用户
export const getSavedUser = (): User | null => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

// 获取本地保存的 token
export const getToken = (): string | null => {
  return localStorage.getItem('token');
};

// 清除认证信息
export const clearAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

// 导出 api 实例供其他模块使用
export default api;

import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || '';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  status?: 'active' | 'pending' | 'banned';
  groupIds?: string[];
  createdAt?: string;
  // 用户资料字段
  avatar?: string;
  avatar_url?: string;
  nickname?: string;
  gender?: string;
  age?: number;
  birthday?: string;
  occupation?: string;
  marital_status?: string;
  province?: string;
  city?: string;
  district?: string;
  address?: string;
  phone?: string;
  wechat?: string;
  qq?: string;
  bio?: string;
  hobbies?: string;
  interests?: string;
  education?: string;
  income_range?: string;
  cover_image?: string;
  birthday_public?: boolean;
  contact_public?: boolean;
  profile_completed?: boolean;
  isProfileCompleted?: boolean;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

// 用户资料接口
export interface UserProfile {
  id?: string;
  username?: string;
  email?: string;
  avatar?: string;
  avatar_url?: string;
  nickname?: string;
  gender?: string;
  age?: number;
  birthday?: string;
  occupation?: string;
  marital_status?: string;
  province?: string;
  city?: string;
  district?: string;
  address?: string;
  phone?: string;
  wechat?: string;
  qq?: string;
  bio?: string;
  hobbies?: string;
  interests?: string;
  education?: string;
  income_range?: string;
  cover_image?: string;
  birthday_public?: boolean;
  contact_public?: boolean;
  isProfileCompleted?: boolean;
}

// 创建 axios 实例
const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000, // 15秒超时，避免请求挂起
});

// 提取错误消息的辅助函数
function extractErrorMessage(error: any): string {
  // 优先从 response.data.error 获取
  if (error.response?.data?.error) {
    return error.response.data.error;
  }
  // 尝试 response.data.message
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  // 尝试 response.statusText
  if (error.response?.statusText) {
    return error.response.statusText;
  }
  // 网络错误
  if (error.code === 'ECONNABORTED') {
    return '请求超时，请检查网络连接';
  }
  if (error.message?.includes('Network Error') || !error.response) {
    return '无法连接服务器，请检查网络或服务是否正常运行';
  }
  // 未知错误
  return '操作失败，请稍后重试';
}

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
    // 登录页面不做重定向，让错误信息正常显示
    if (error.response?.status === 401 || error.response?.status === 403) {
      if (window.location.pathname !== '/login') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// 注册
export const register = async (username: string, email: string, password: string, inviteCode?: string): Promise<AuthResponse> => {
  const response = await api.post('/api/auth/register', { username, email, password, inviteCode });
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

// ===== 用户资料 API =====

// 获取当前用户资料
export const getUserProfile = async (): Promise<UserProfile> => {
  const response = await api.get('/api/auth/profile');
  return response.data;
};

// 更新当前用户资料
export const updateUserProfile = async (data: Partial<UserProfile>): Promise<any> => {
  const res = await api.put('/api/auth/profile', data);
  return res.data;
};

// 上传用户头像
export const uploadAvatar = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('avatar', file);
  const response = await api.post('/api/auth/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data.url;
};

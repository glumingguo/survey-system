import api from './auth';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || '';

// ====== 站点设置 ======
export interface SiteSettings {
  siteName?: string;
  siteSubtitle?: string;
  loginBg?: string;
  sidebarLogo?: string;
  heroBanner?: string;
  registerMode?: 'open' | 'invite' | 'approval' | 'closed';
  // 菜单自定义名称
  menuLabels?: {
    dashboard?: string;
    announcements?: string;
    messages?: string;
    resources?: string;
    albums?: string;
    surveys?: string;
    members?: string;
    inviteCodes?: string;
    visitStats?: string;
    siteSettings?: string;
    emailSettings?: string;
  };
  // 首页模块图标（emoji 或 Ant Design 图标名称）
  moduleIcons?: {
    resources?: string;
    albums?: string;
    surveys?: string;
  };
  // 首页标题样式（显示在横幅上方）
  heroTitleStyle?: {
    fontSize?: number; // 标题字体大小，默认48
    subtitleFontSize?: number; // 副标题字体大小，默认18
    titleColor?: string; // 标题颜色，默认 #fff
    subtitleColor?: string; // 副标题颜色，默认 rgba(255,255,255,0.85)
    position?: 'top' | 'center' | 'bottom'; // 位置，默认 center
  };
  // 首页滚动公告配置
  marqueeConfig?: {
    enabled?: boolean; // 是否启用滚动
    announcementIds?: string[]; // 要滚动的公告ID列表（空则显示所有）
    fontSize?: number; // 字体大小，默认16
    color?: string; // 文字颜色，默认 #fff
    background?: string; // 背景色，默认 rgba(0,0,0,0.5)
    speed?: number; // 滚动速度（秒），默认 20
  };
  // 首页模块图片（优先于 emoji 图标）
  moduleImages?: {
    resources?: string;
    albums?: string;
    surveys?: string;
  };
  // 首页背景配置
  homePageStyle?: {
    backgroundColor?: string; // 背景色，默认 #f0f2f5
    backgroundImage?: string; // 背景图（可选）
    backgroundOpacity?: number; // 背景图透明度 0-1，默认 1
    moduleCount?: number; // 显示模块数量 1-3，默认 3
    containerPadding?: number; // 内容区内边距，默认 24
  };
}

export const getSiteSettings = async (): Promise<SiteSettings> => {
  const res = await axios.get(`${API_BASE}/api/site-settings`);
  return res.data;
};

export const getAdminSiteSettings = async (): Promise<SiteSettings> => {
  const res = await api.get('/api/admin/site-settings');
  return res.data;
};

export const updateSiteSettings = async (settings: SiteSettings): Promise<SiteSettings> => {
  const res = await api.put('/api/admin/site-settings', settings);
  return res.data.settings;
};

export const uploadSiteImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('image', file);
  const res = await api.post('/api/admin/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data.url;
};

// ====== 用户分组 ======
export interface UserGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  created_at?: string;
}

export const getGroups = async (): Promise<UserGroup[]> => {
  const res = await api.get('/api/admin/groups');
  return res.data;
};

export const createGroup = async (data: Partial<UserGroup>): Promise<UserGroup> => {
  const res = await api.post('/api/admin/groups', data);
  return res.data;
};

export const updateGroup = async (id: string, data: Partial<UserGroup>): Promise<UserGroup> => {
  const res = await api.put(`/api/admin/groups/${id}`, data);
  return res.data;
};

export const deleteGroup = async (id: string): Promise<void> => {
  await api.delete(`/api/admin/groups/${id}`);
};

// ====== 用户管理 ======
export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  group_ids: string[];
  created_at: string;
}

export const getAdminUsers = async (): Promise<AdminUser[]> => {
  const res = await api.get('/api/admin/users');
  return res.data;
};

export const updateUserStatus = async (userId: string, status: string): Promise<AdminUser> => {
  const res = await api.put(`/api/admin/users/${userId}/status`, { status });
  return res.data;
};

export const updateUserGroups = async (userId: string, groupIds: string[]): Promise<AdminUser> => {
  const res = await api.put(`/api/admin/users/${userId}/groups`, { groupIds });
  return res.data;
};

export const deleteAdminUser = async (userId: string): Promise<void> => {
  await api.delete(`/api/admin/users/${userId}`);
};

// ====== 邀请码 ======
export interface InviteCode {
  id: string;
  code: string;
  note?: string;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  expires_at?: string;
  created_at: string;
}

export const getInviteCodes = async (): Promise<InviteCode[]> => {
  const res = await api.get('/api/admin/invite-codes');
  return res.data;
};

export const createInviteCode = async (data: { note?: string; maxUses?: number; expiresAt?: string }): Promise<InviteCode> => {
  const res = await api.post('/api/admin/invite-codes', data);
  return res.data;
};

export const toggleInviteCode = async (id: string, isActive: boolean): Promise<InviteCode> => {
  const res = await api.put(`/api/admin/invite-codes/${id}`, { isActive });
  return res.data;
};

export const deleteInviteCode = async (id: string): Promise<void> => {
  await api.delete(`/api/admin/invite-codes/${id}`);
};

// ====== 资源库 ======
export interface ResourceFolder {
  id: string;
  name: string;
  description?: string;
  cover_image?: string;
  access_type: 'public' | 'members' | 'groups';
  allowed_group_ids: string[];
  sort_order?: number;
  created_at?: string;
}

export interface ResourceFile {
  id: string;
  folder_id: string;
  name: string;
  original_name: string;
  file_path: string;
  file_type?: string;
  file_size?: number;
  description?: string;
  created_at?: string;
}

export const getResourceFolders = async (): Promise<ResourceFolder[]> => {
  const res = await api.get('/api/resource-folders');
  return res.data;
};

export const createResourceFolder = async (data: Partial<ResourceFolder>): Promise<ResourceFolder> => {
  const res = await api.post('/api/admin/resource-folders', data);
  return res.data;
};

export const updateResourceFolder = async (id: string, data: Partial<ResourceFolder>): Promise<ResourceFolder> => {
  const res = await api.put(`/api/admin/resource-folders/${id}`, data);
  return res.data;
};

export const deleteResourceFolder = async (id: string): Promise<void> => {
  await api.delete(`/api/admin/resource-folders/${id}`);
};

export const getFolderFiles = async (folderId: string): Promise<ResourceFile[]> => {
  const res = await api.get(`/api/resource-folders/${folderId}/files`);
  return res.data;
};

export const uploadResourceFile = async (folderId: string, file: File, description?: string): Promise<ResourceFile> => {
  const formData = new FormData();
  formData.append('file', file);
  if (description) formData.append('description', description);
  const res = await api.post(`/api/admin/resource-folders/${folderId}/files`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
};

export const deleteResourceFile = async (fileId: string): Promise<void> => {
  await api.delete(`/api/admin/resource-files/${fileId}`);
};

// ====== 公告 ======
export interface Announcement {
  id: string;
  title: string;
  content: string;
  target_type: 'all' | 'members' | 'groups';
  target_group_ids: string[];
  is_pinned: boolean;
  created_at: string;
  updated_at?: string;
}

export const getAnnouncements = async (): Promise<Announcement[]> => {
  const res = await api.get('/api/announcements');
  return res.data;
};

export const createAnnouncement = async (data: Partial<Announcement>): Promise<Announcement> => {
  const res = await api.post('/api/admin/announcements', data);
  return res.data;
};

export const updateAnnouncement = async (id: string, data: Partial<Announcement>): Promise<Announcement> => {
  const res = await api.put(`/api/admin/announcements/${id}`, data);
  return res.data;
};

export const deleteAnnouncement = async (id: string): Promise<void> => {
  await api.delete(`/api/admin/announcements/${id}`);
};

// ====== 私信 ======
export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  sender_name?: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export const getMessages = async (): Promise<Message[]> => {
  const res = await api.get('/api/messages');
  return res.data;
};

export const getMessagesWith = async (userId: string): Promise<Message[]> => {
  const res = await api.get(`/api/messages/${userId}`);
  return res.data;
};

export const sendMessage = async (content: string, receiverId?: string): Promise<Message> => {
  const res = await api.post('/api/messages', { content, receiverId });
  return res.data;
};

export const getUnreadCount = async (): Promise<number> => {
  const res = await api.get('/api/messages/unread/count');
  return res.data.count;
};

// ====== 访客统计 ======
export interface VisitStats {
  daily: Array<{ date: string; count: string }>;
  activeUsers: Array<{ username: string; visit_count: string; last_visit: string }>;
  total: number;
  today: number;
  recent: Array<{ id: number; username?: string; path: string; ip_address?: string; created_at: string }>;
}

export const getVisitStats = async (days = 7): Promise<VisitStats> => {
  const res = await api.get(`/api/admin/visit-stats?days=${days}`);
  return res.data;
};

// ====== 相册 ======
export interface Album {
  id: string;
  name: string;
  description?: string;
  cover_image?: string;
  access_type: 'public' | 'members' | 'groups';
  allowed_group_ids: string[];
  photoCount?: number;
  photos?: AlbumPhoto[];
  created_at?: string;
}

export interface AlbumPhoto {
  id: string;
  album_id: string;
  name: string;
  file_path: string;
  description?: string;
  created_at?: string;
}

export const getAlbums = async (): Promise<Album[]> => {
  const res = await api.get('/api/albums');
  return res.data;
};

export const getAlbum = async (id: string): Promise<Album> => {
  const res = await api.get(`/api/albums/${id}`);
  return res.data;
};

export const createAlbum = async (data: Partial<Album>): Promise<Album> => {
  const res = await api.post('/api/admin/albums', data);
  return res.data;
};

export const updateAlbum = async (id: string, data: Partial<Album>): Promise<Album> => {
  const res = await api.put(`/api/admin/albums/${id}`, data);
  return res.data;
};

export const deleteAlbum = async (id: string): Promise<void> => {
  await api.delete(`/api/admin/albums/${id}`);
};

export const uploadPhotos = async (albumId: string, files: File[]): Promise<AlbumPhoto[]> => {
  const formData = new FormData();
  files.forEach(f => formData.append('photos', f));
  const res = await api.post(`/api/admin/albums/${albumId}/photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
};

export const deletePhoto = async (photoId: string): Promise<void> => {
  await api.delete(`/api/admin/album-photos/${photoId}`);
};

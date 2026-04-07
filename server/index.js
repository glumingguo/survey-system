require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { nanoid } = require('nanoid');
const QRCode = require('qrcode');
const { PDFParse } = require('pdf-parse');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

// 调试：打印环境变量
console.log('环境变量加载测试:');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '已设置' : '未设置');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '已设置' : '未设置');
console.log('PORT:', process.env.PORT ? '已设置' : '未设置');

// 同步加载模块
let nodemailerModule;
let xlsxModule;
let pdfModule;
try {
  nodemailerModule = require('nodemailer');
  xlsxModule = require('xlsx');
  pdfModule = require('jspdf');
} catch (e) {
  console.error('加载模块失败:', e.message);
}

// JWT 密钥
const JWT_SECRET = process.env.JWT_SECRET || 'survey-system-secret-key-2024';

// ===== PostgreSQL 连接池 =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

// 初始化数据库表结构
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(20) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(200) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        status VARCHAR(20) DEFAULT 'active',
        group_ids JSONB DEFAULT '[]',
        avatar TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS surveys (
        id VARCHAR(20) PRIMARY KEY,
        user_id VARCHAR(20),
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS responses (
        id VARCHAR(20) PRIMARY KEY,
        survey_id VARCHAR(20) NOT NULL,
        answers JSONB,
        files JSONB,
        submitted_at TIMESTAMPTZ DEFAULT NOW(),
        ip_address TEXT
      );

      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB
      );

      CREATE TABLE IF NOT EXISTS short_links (
        code VARCHAR(20) PRIMARY KEY,
        original_url TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_groups (
        id VARCHAR(20) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        color VARCHAR(20) DEFAULT '#1890ff',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS resource_folders (
        id VARCHAR(20) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        cover_image TEXT,
        access_type VARCHAR(20) DEFAULT 'members',
        allowed_group_ids JSONB DEFAULT '[]',
        sort_order INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS resource_files (
        id VARCHAR(20) PRIMARY KEY,
        folder_id VARCHAR(20) NOT NULL,
        name VARCHAR(500) NOT NULL,
        original_name VARCHAR(500) NOT NULL,
        file_path TEXT NOT NULL,
        file_type VARCHAR(100),
        file_size BIGINT,
        description TEXT,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS announcements (
        id VARCHAR(20) PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        content TEXT NOT NULL,
        target_type VARCHAR(20) DEFAULT 'all',
        target_group_ids JSONB DEFAULT '[]',
        is_pinned BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(20) PRIMARY KEY,
        sender_id VARCHAR(20) NOT NULL,
        receiver_id VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS visit_logs (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(20),
        username VARCHAR(100),
        path TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS albums (
        id VARCHAR(20) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        cover_image TEXT,
        access_type VARCHAR(20) DEFAULT 'members',
        allowed_group_ids JSONB DEFAULT '[]',
        sort_order INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS album_photos (
        id VARCHAR(20) PRIMARY KEY,
        album_id VARCHAR(20) NOT NULL,
        name VARCHAR(500) NOT NULL,
        file_path TEXT NOT NULL,
        description TEXT,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS invite_codes (
        id VARCHAR(20) PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        note TEXT,
        max_uses INT DEFAULT 1,
        used_count INT DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 添加新字段（如果不存在）
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS group_ids JSONB DEFAULT '[]';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
    `);

    // 创建用户资料扩展表（存储更详细的用户信息）
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id VARCHAR(20) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        nickname VARCHAR(100),          -- 昵称
        gender VARCHAR(20),              -- 性别：male/female/other
        age INTEGER,                     -- 年龄
        birthday VARCHAR(20),           -- 生日
        occupation VARCHAR(100),         -- 职业
        marital_status VARCHAR(20),      -- 婚姻状况：single/married/divorced/widowed
        province VARCHAR(50),            -- 所在省份
        city VARCHAR(50),                -- 所在城市
        district VARCHAR(50),            -- 所在区县
        address TEXT,                    -- 详细地址
        phone VARCHAR(50),               -- 联系电话
        wechat VARCHAR(100),            -- 微信号
        qq VARCHAR(50),                 -- QQ号
        bio TEXT,                        -- 个人简介
        hobbies TEXT,                    -- 个人爱好（JSON数组）
        interests TEXT,                  -- 兴趣标签（逗号分隔）
        education VARCHAR(20),           -- 学历
        income_range VARCHAR(50),       -- 收入范围
        avatar_url TEXT,                 -- 头像URL（可独立于users表的avatar）
        cover_image TEXT,                -- 个人主页封面图
        birthday_public BOOLEAN DEFAULT false,  -- 生日是否公开
        contact_public BOOLEAN DEFAULT false,    -- 联系方式是否公开
        profile_completed BOOLEAN DEFAULT false, -- 资料是否完善
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('数据库表初始化完成');
  } catch (err) {
    console.error('数据库初始化失败:', err);
  } finally {
    client.release();
  }
}

initDB();

function createTransporter(config) {
  if (!nodemailerModule) throw new Error('nodemailer模块未正确加载');
  const createFn = nodemailerModule.createTransport || nodemailerModule.createTransporter;
  if (!createFn) throw new Error('nodemailer版本不支持');
  return createFn.call(nodemailerModule, config);
}

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// ========== 认证中间件 ==========
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: '需要登录才能访问' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: '登录已过期，请重新登录' });
    req.user = user;
    next();
  });
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (!err) req.user = user;
    });
  }
  next();
}

// ========== 用户认证 API ==========

// 用户注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, inviteCode } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: '用户名、邮箱和密码不能为空' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少需要6个字符' });
    }

    // 检查用户名/邮箱是否已存在
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: '用户名或邮箱已存在' });
    }

    // 获取注册设置
    const siteSettingsResult = await pool.query("SELECT value FROM settings WHERE key = 'siteSettings'");
    const siteSettings = siteSettingsResult.rows[0] ? siteSettingsResult.rows[0].value : {};
    const registerMode = siteSettings.registerMode || 'open'; // open | invite | approval | closed

    const isAdmin = username === 'S驯养灵魂';

    if (!isAdmin) {
      if (registerMode === 'closed') {
        return res.status(403).json({ error: '当前网站不开放注册' });
      }
      if (registerMode === 'invite') {
        if (!inviteCode) return res.status(400).json({ error: '需要邀请码才能注册' });
        const codeResult = await pool.query(
          "SELECT * FROM invite_codes WHERE code = $1 AND is_active = true AND (expires_at IS NULL OR expires_at > NOW())",
          [inviteCode]
        );
        if (!codeResult.rows[0]) return res.status(400).json({ error: '邀请码无效或已过期' });
        const codeRow = codeResult.rows[0];
        if (codeRow.used_count >= codeRow.max_uses) return res.status(400).json({ error: '邀请码已达使用上限' });
        // 使用邀请码
        await pool.query('UPDATE invite_codes SET used_count = used_count + 1 WHERE id = $1', [codeRow.id]);
        if (codeRow.used_count + 1 >= codeRow.max_uses) {
          await pool.query('UPDATE invite_codes SET is_active = false WHERE id = $1', [codeRow.id]);
        }
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = isAdmin ? 'admin' : 'user';
    // 审批模式下新用户状态为 pending
    const status = (!isAdmin && registerMode === 'approval') ? 'pending' : 'active';
    const id = nanoid(10);

    await pool.query(
      'INSERT INTO users (id, username, email, password, role, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, username, email, hashedPassword, role, status]
    );

    if (status === 'pending') {
      return res.json({ message: '注册申请已提交，请等待管理员审核' });
    }

    const token = jwt.sign({ id, username, role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      message: '注册成功',
      token,
      user: { id, username, email, role, status }
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

// 用户登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $1',
      [username]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: '用户名或密码错误' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ error: '用户名或密码错误' });

    // 检查账号状态
    if (user.status === 'pending') return res.status(403).json({ error: '您的账号正在等待管理员审核' });
    if (user.status === 'banned') return res.status(403).json({ error: '您的账号已被禁用，请联系管理员' });

    // 唯一管理员保护：S驯养灵魂 始终是 admin
    if (user.username === 'S驯养灵魂' && user.role !== 'admin') {
      await pool.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', user.id]);
      user.role = 'admin';
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      message: '登录成功',
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 获取当前用户信息
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, email, role, created_at FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: '用户不存在' });
    const u = result.rows[0];
    res.json({ id: u.id, username: u.username, email: u.email, role: u.role, createdAt: u.created_at });
  } catch (error) {
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// 修改密码
app.put('/api/auth/password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ error: '请填写所有字段' });
    if (newPassword.length < 6) return res.status(400).json({ error: '新密码至少需要6个字符' });

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: '用户不存在' });

    const validPassword = await bcrypt.compare(oldPassword, user.password);
    if (!validPassword) return res.status(401).json({ error: '原密码错误' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id]);
    res.json({ message: '密码修改成功' });
  } catch (error) {
    res.status(500).json({ error: '修改密码失败' });
  }
});

// ========== 用户资料 API ==========

// 获取当前用户的资料
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    // 获取用户基本信息
    const userResult = await pool.query(
      'SELECT id, username, email, role, status, avatar, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!userResult.rows[0]) return res.status(404).json({ error: '用户不存在' });

    // 获取详细资料
    const profileResult = await pool.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [req.user.id]
    );

    const user = userResult.rows[0];
    const profile = profileResult.rows[0] || {};

    res.json({
      ...user,
      ...profile,
      isProfileCompleted: profile.profile_completed || false,
    });
  } catch (error) {
    console.error('获取用户资料失败:', error);
    res.status(500).json({ error: '获取用户资料失败' });
  }
});

// 更新当前用户的资料
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const {
      nickname, gender, age, birthday, occupation, marital_status,
      province, city, district, address, phone, wechat, qq,
      bio, hobbies, interests, education, income_range,
      avatar_url, cover_image, birthday_public, contact_public
    } = req.body;

    // 检查是否已有资料记录
    const checkResult = await pool.query(
      'SELECT user_id FROM user_profiles WHERE user_id = $1',
      [req.user.id]
    );

    const profileData = {
      nickname, gender, age, birthday, occupation, marital_status,
      province, city, district, address, phone, wechat, qq,
      bio, hobbies, interests, education, income_range,
      avatar_url, cover_image, birthday_public, contact_public,
      profile_completed: true
    };

    // 过滤掉 undefined 值
    const cleanData = Object.fromEntries(
      Object.entries(profileData).filter(([_, v]) => v !== undefined)
    );

    if (checkResult.rows.length === 0) {
      // 新增资料记录
      await pool.query(
        `INSERT INTO user_profiles (user_id, ${Object.keys(cleanData).join(', ')}, updated_at)
         VALUES ($1, ${Object.keys(cleanData).map((_, i) => `$${i + 2}`).join(', ')}, NOW())
         ON CONFLICT (user_id) DO UPDATE SET ${Object.keys(cleanData).map(k => `${k} = EXCLUDED.${k}`).join(', ')}, updated_at = NOW()`,
        [req.user.id, ...Object.values(cleanData)]
      );
    } else {
      // 更新资料
      const setClause = Object.keys(cleanData).map((k, i) => `${k} = $${i + 2}`).join(', ');
      await pool.query(
        `UPDATE user_profiles SET ${setClause}, updated_at = NOW() WHERE user_id = $1`,
        [req.user.id, ...Object.values(cleanData)]
      );
    }

    // 如果用户设置了头像，也更新到 users 表
    if (avatar_url !== undefined) {
      await pool.query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar_url, req.user.id]);
    }

    res.json({ message: '资料更新成功' });
  } catch (error) {
    console.error('更新用户资料失败:', error);
    res.status(500).json({ error: '更新用户资料失败' });
  }
});

// 上传用户头像
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, 'uploads', 'avatars');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, `avatar-${req.user.id}-${Date.now()}${path.extname(file.originalname)}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('只允许上传图片'));
  }
});

app.post('/api/auth/avatar', authenticateToken, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '没有上传文件' });

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // 同时更新 users 表和 user_profiles 表
    await pool.query('UPDATE users SET avatar = $1 WHERE id = $2', [avatarUrl, req.user.id]);
    await pool.query(
      'UPDATE user_profiles SET avatar_url = $1, updated_at = NOW() WHERE user_id = $2',
      [avatarUrl, req.user.id]
    );

    res.json({ url: avatarUrl });
  } catch (error) {
    console.error('上传头像失败:', error);
    res.status(500).json({ error: '上传头像失败' });
  }
});

// ===== 管理员工具接口 =====

// 设置唯一管理员
app.post('/api/admin/set-admin', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: '请提供用户名' });

    // 移除所有现有管理员
    await pool.query("UPDATE users SET role = 'user' WHERE role = 'admin'");

    const result = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (!result.rows[0]) return res.status(404).json({ error: '用户不存在' });

    await pool.query("UPDATE users SET role = 'admin' WHERE username = $1", [username]);
    res.json({ message: `用户 ${username} 已设为唯一管理员` });
  } catch (error) {
    res.status(500).json({ error: '设置失败' });
  }
});

// 重置密码
app.post('/api/admin/reset-password', async (req, res) => {
  try {
    const { username, newPassword } = req.body;
    if (!username || !newPassword) return res.status(400).json({ error: '请提供用户名和新密码' });

    const result = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (!result.rows[0]) return res.status(404).json({ error: '用户不存在' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE username = $2', [hashed, username]);
    res.json({ message: `用户 ${username} 的密码已重置` });
  } catch (error) {
    res.status(500).json({ error: '密码重置失败' });
  }
});

// 将无主问卷归属给指定用户（一次性迁移）
app.post('/api/admin/claim-surveys', async (req, res) => {
  try {
    const { username } = req.body;
    const result = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (!result.rows[0]) return res.status(404).json({ error: '用户不存在' });

    const userId = result.rows[0].id;
    const updated = await pool.query(
      "UPDATE surveys SET user_id = $1 WHERE user_id IS NULL OR user_id = ''",
      [userId]
    );
    res.json({ message: `已将 ${updated.rowCount} 份无主问卷归属给 ${username}` });
  } catch (error) {
    res.status(500).json({ error: '迁移失败' });
  }
});

// ========== 问卷管理 API ==========

// 获取所有问卷
app.get('/api/surveys', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM surveys ORDER BY created_at DESC');
    const surveys = result.rows.map(row => ({
      ...row.data,
      id: row.id,
      userId: row.user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    res.json(surveys);
  } catch (error) {
    res.status(500).json({ error: '获取问卷列表失败' });
  }
});

// 获取问卷详情
app.get('/api/surveys/:id', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM surveys WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: '问卷不存在' });
    const row = result.rows[0];
    const survey = {
      ...row.data,
      id: row.id,
      userId: row.user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
    const isOwner = req.user && (survey.userId === req.user.id || req.user.role === 'admin');
    res.json({ ...survey, isOwner });
  } catch (error) {
    res.status(500).json({ error: '获取问卷详情失败' });
  }
});

// 创建问卷
app.post('/api/surveys', authenticateToken, async (req, res) => {
  try {
    const id = nanoid(10);
    const { userId: _u, id: _i, createdAt: _c, updatedAt: _upd, ...surveyData } = req.body;
    await pool.query(
      'INSERT INTO surveys (id, user_id, data) VALUES ($1, $2, $3)',
      [id, req.user.id, JSON.stringify(surveyData)]
    );
    const result = await pool.query('SELECT * FROM surveys WHERE id = $1', [id]);
    const row = result.rows[0];
    res.json({
      ...row.data,
      id: row.id,
      userId: row.user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  } catch (error) {
    console.error('创建问卷失败:', error);
    res.status(500).json({ error: '创建问卷失败' });
  }
});

// 更新问卷
app.put('/api/surveys/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM surveys WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: '问卷不存在' });
    const row = result.rows[0];
    if (row.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权限修改此问卷' });
    }
    const { userId: _u, id: _i, createdAt: _c, updatedAt: _upd, ...surveyData } = req.body;
    await pool.query(
      'UPDATE surveys SET data = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(surveyData), req.params.id]
    );
    const updated = await pool.query('SELECT * FROM surveys WHERE id = $1', [req.params.id]);
    const r = updated.rows[0];
    res.json({
      ...r.data,
      id: r.id,
      userId: r.user_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    });
  } catch (error) {
    res.status(500).json({ error: '更新问卷失败' });
  }
});

// 删除问卷
app.delete('/api/surveys/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM surveys WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: '问卷不存在' });
    const row = result.rows[0];
    if (row.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权限删除此问卷' });
    }
    await pool.query('DELETE FROM surveys WHERE id = $1', [req.params.id]);
    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: '删除问卷失败' });
  }
});

// 获取我的问卷列表
app.get('/api/surveys/my', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM surveys WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    const surveys = result.rows.map(row => ({
      ...row.data,
      id: row.id,
      userId: row.user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    res.json(surveys);
  } catch (error) {
    res.status(500).json({ error: '获取问卷列表失败' });
  }
});

// ========== 问卷响应 API ==========

app.get('/api/surveys/:id/responses', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM responses WHERE survey_id = $1 ORDER BY submitted_at DESC',
      [req.params.id]
    );
    const responses = result.rows.map(row => ({
      id: row.id,
      surveyId: row.survey_id,
      answers: row.answers,
      files: row.files,
      submittedAt: row.submitted_at,
      ipAddress: row.ip_address
    }));
    res.json(responses);
  } catch (error) {
    res.status(500).json({ error: '获取答卷列表失败' });
  }
});

app.post('/api/surveys/:id/responses', upload.array('files'), async (req, res) => {
  try {
    const files = req.files ? req.files.map(file => ({
      name: file.originalname,
      path: `/uploads/${file.filename}`,
      size: file.size,
      type: file.mimetype
    })) : [];

    const id = nanoid(10);
    const answers = req.body.answers ? JSON.parse(req.body.answers) : req.body;
    await pool.query(
      'INSERT INTO responses (id, survey_id, answers, files, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [id, req.params.id, JSON.stringify(answers), JSON.stringify(files), req.ip]
    );
    const response = { id, surveyId: req.params.id, answers, files, submittedAt: new Date().toISOString(), ipAddress: req.ip };
    await sendPDF(response);
    res.json(response);
  } catch (error) {
    console.error('提交答卷失败:', error);
    res.status(500).json({ error: '提交答卷失败' });
  }
});

// ========== 统计分析 ==========
app.get('/api/surveys/:id/statistics', authenticateToken, async (req, res) => {
  try {
    const surveyResult = await pool.query('SELECT * FROM surveys WHERE id = $1', [req.params.id]);
    if (!surveyResult.rows[0]) return res.status(404).json({ error: '问卷不存在' });
    const row = surveyResult.rows[0];
    const survey = { ...row.data, id: row.id, userId: row.user_id };

    if (survey.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权限查看此问卷统计' });
    }

    const respResult = await pool.query('SELECT * FROM responses WHERE survey_id = $1', [req.params.id]);
    const responses = respResult.rows.map(r => ({ answers: r.answers }));

    const statistics = {
      totalResponses: responses.length,
      questions: survey.questions.map(question => {
        const stats = { id: question.id, title: question.title, type: question.type };
        if (question.type === 'singleChoice' || question.type === 'multipleChoice') {
          const options = question.options || [];
          const counts = {};
          options.forEach(opt => counts[opt] = 0);
          responses.forEach(response => {
            const answer = response.answers[question.id];
            if (Array.isArray(answer)) answer.forEach(a => counts[a] = (counts[a] || 0) + 1);
            else if (answer) counts[answer] = (counts[answer] || 0) + 1;
          });
          stats.optionCounts = counts;
          stats.percentage = {};
          options.forEach(opt => {
            stats.percentage[opt] = responses.length > 0 ? ((counts[opt] / responses.length) * 100).toFixed(2) : 0;
          });
        } else if (question.type === 'text' || question.type === 'textarea') {
          stats.answers = responses.map(r => r.answers[question.id]).filter(a => a && a.trim());
        }
        return stats;
      })
    };
    res.json(statistics);
  } catch (error) {
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

// ========== 二维码 ==========
app.get('/api/surveys/:id/qrcode', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM surveys WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: '问卷不存在' });
    const survey = { ...result.rows[0].data, id: result.rows[0].id };
    const { protocol, host } = req.headers;
    const surveyUrl = survey.sequentialMode
      ? `${protocol}://${host}/survey/${req.params.id}/sequential`
      : `${protocol}://${host}/survey/${req.params.id}`;
    const qrCode = await QRCode.toBuffer(surveyUrl);
    res.type('png');
    res.send(qrCode);
  } catch (error) {
    res.status(500).json({ error: '生成二维码失败' });
  }
});

// ========== 短链接 ==========
app.post('/api/shortlink', async (req, res) => {
  try {
    const { url } = req.body;
    const code = nanoid(6);
    await pool.query('INSERT INTO short_links (code, original_url) VALUES ($1, $2)', [code, url]);
    const shortUrl = `${req.protocol}://${req.headers.host}/s/${code}`;
    res.json({ shortUrl, code });
  } catch (error) {
    res.status(500).json({ error: '生成短链接失败' });
  }
});

app.get('/s/:code', async (req, res) => {
  try {
    const result = await pool.query('SELECT original_url FROM short_links WHERE code = $1', [req.params.code]);
    if (result.rows[0]) res.redirect(result.rows[0].original_url);
    else res.status(404).json({ error: '短链接不存在' });
  } catch (error) {
    res.status(500).json({ error: '跳转失败' });
  }
});

// ========== 文件上传 ==========
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '没有上传文件' });
  res.json({
    name: req.file.originalname,
    path: `/uploads/${req.file.filename}`,
    size: req.file.size,
    type: req.file.mimetype
  });
});

// PDF 解析
app.post('/api/parse-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '没有上传PDF文件' });
    if (!req.file.originalname.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ error: '请上传PDF文件' });
    }
    const dataBuffer = fs.readFileSync(req.file.path);
    const uint8Array = new Uint8Array(dataBuffer);
    const parser = new PDFParse(uint8Array);
    await parser.load();
    const pdfResult = await parser.getText();
    const text = pdfResult.text;
    const questions = parseQuestionsFromText(text);
    fs.unlinkSync(req.file.path);
    res.json({ success: true, questionCount: questions.length, questions, rawText: text.substring(0, 1000) });
  } catch (error) {
    console.error('PDF解析失败:', error);
    res.status(500).json({ error: 'PDF解析失败: ' + error.message });
  }
});

// ========== 邮件设置 ==========
app.post('/api/settings/email', async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      ['emailConfig', JSON.stringify(req.body)]
    );
    res.json({ message: '邮件配置已更新' });
  } catch (error) {
    console.error('保存邮件配置失败:', error);
    res.status(500).json({ error: '更新邮件配置失败' });
  }
});

app.get('/api/settings/email', async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'emailConfig'");
    res.json(result.rows[0] ? result.rows[0].value : {});
  } catch (error) {
    res.status(500).json({ error: '获取邮件配置失败' });
  }
});

app.post('/api/settings/email/test', async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'emailConfig'");
    const config = result.rows[0] ? result.rows[0].value : null;
    if (!config || !config.host) return res.status(400).json({ error: '请先配置邮件服务器' });
    if (!config.fromEmail || !config.to) return res.status(400).json({ error: '请配置发件人邮箱和收件人邮箱' });
    const fromAddress = config.fromName ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail;
    const transporter = createTransporter({
      host: config.host, port: config.port, secure: config.secure,
      auth: { user: config.user, pass: config.pass }
    });
    await transporter.sendMail({
      from: fromAddress, to: config.to,
      subject: '测试邮件 - 问卷系统',
      html: '<h2>这是一封测试邮件</h2><p>问卷系统邮件配置成功！</p>'
    });
    res.json({ message: '测试邮件发送成功' });
  } catch (error) {
    console.error('测试邮件发送失败:', error);
    res.status(500).json({ error: `发送失败: ${error.message}` });
  }
});

// 发送 PDF 邮件
async function sendPDF(response) {
  try {
    const cfgResult = await pool.query("SELECT value FROM settings WHERE key = 'emailConfig'");
    const config = cfgResult.rows[0] ? cfgResult.rows[0].value : null;
    if (!config || !config.host) return;

    const surveyResult = await pool.query('SELECT * FROM surveys WHERE id = $1', [response.surveyId]);
    if (!surveyResult.rows[0]) return;
    const survey = { ...surveyResult.rows[0].data, id: surveyResult.rows[0].id };

    const transporter = createTransporter({
      host: config.host, port: config.port, secure: config.secure,
      auth: { user: config.user, pass: config.pass }
    });
    const recipientEmail = response.answers.email || config.to;
    if (!recipientEmail) return;
    const fromAddress = config.fromName ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail;

    let htmlContent = `<h2>${survey.title}</h2>`;
    htmlContent += `<p><strong>提交时间：</strong>${new Date(response.submittedAt).toLocaleString('zh-CN')}</p><hr>`;
    survey.questions.forEach(question => {
      const answer = response.answers[question.id];
      htmlContent += `<h3>${question.title}</h3>`;
      if (Array.isArray(answer)) htmlContent += `<p><strong>回答：</strong>${answer.join(', ')}</p>`;
      else if (answer) htmlContent += `<p><strong>回答：</strong>${answer}</p>`;
      htmlContent += '<br>';
    });
    if (response.files && response.files.length > 0) {
      htmlContent += '<h3>上传的文件：</h3><ul>';
      response.files.forEach(file => { htmlContent += `<li>${file.name} (${(file.size / 1024).toFixed(2)} KB)</li>`; });
      htmlContent += '</ul>';
    }
    await transporter.sendMail({
      from: fromAddress, to: recipientEmail,
      subject: `问卷提交通知 - ${survey.title}`, html: htmlContent
    });
    console.log('邮件发送成功:', recipientEmail);
  } catch (error) {
    console.error('发送邮件失败:', error);
  }
}

// ========== 数据导出 ==========

app.get('/api/surveys/:id/export/excel', authenticateToken, async (req, res) => {
  try {
    const sResult = await pool.query('SELECT * FROM surveys WHERE id = $1', [req.params.id]);
    if (!sResult.rows[0]) return res.status(404).json({ error: '问卷不存在' });
    const survey = { ...sResult.rows[0].data, id: sResult.rows[0].id, userId: sResult.rows[0].user_id };
    if (survey.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权限导出此问卷数据' });
    }
    const rResult = await pool.query('SELECT * FROM responses WHERE survey_id = $1', [req.params.id]);
    const responses = rResult.rows.map(r => ({ answers: r.answers, files: r.files, submittedAt: r.submitted_at }));

    const headers = ['提交时间'];
    survey.questions.forEach(q => headers.push(q.title));
    const rows = responses.map(r => {
      const row = [new Date(r.submittedAt).toLocaleString('zh-CN')];
      survey.questions.forEach(q => {
        const answer = r.answers[q.id];
        row.push(Array.isArray(answer) ? answer.join(', ') : (answer || ''));
      });
      return row;
    });
    const worksheet = xlsxModule.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = xlsxModule.utils.book_new();
    xlsxModule.utils.book_append_sheet(workbook, worksheet, '答卷数据');
    const buffer = xlsxModule.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(survey.title)}_答卷数据.xlsx`);
    res.send(buffer);
  } catch (error) {
    console.error('导出Excel失败:', error);
    res.status(500).json({ error: '导出失败' });
  }
});

app.get('/api/surveys/:id/export/csv', authenticateToken, async (req, res) => {
  try {
    const sResult = await pool.query('SELECT * FROM surveys WHERE id = $1', [req.params.id]);
    if (!sResult.rows[0]) return res.status(404).json({ error: '问卷不存在' });
    const survey = { ...sResult.rows[0].data, id: sResult.rows[0].id, userId: sResult.rows[0].user_id };
    if (survey.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权限导出此问卷数据' });
    }
    const rResult = await pool.query('SELECT * FROM responses WHERE survey_id = $1', [req.params.id]);
    const responses = rResult.rows.map(r => ({ answers: r.answers, files: r.files, submittedAt: r.submitted_at }));

    const headers = ['提交时间'];
    survey.questions.forEach(q => headers.push(q.title));
    const escapeCSV = (str) => {
      if (str == null) return '';
      const s = String(str);
      return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    let csv = headers.map(escapeCSV).join(',') + '\n';
    responses.forEach(r => {
      const row = [new Date(r.submittedAt).toLocaleString('zh-CN')];
      survey.questions.forEach(q => {
        const answer = r.answers[q.id];
        row.push(Array.isArray(answer) ? answer.join(', ') : (answer || ''));
      });
      csv += row.map(escapeCSV).join(',') + '\n';
    });
    res.setHeader('Content-Type', 'text/csv;charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(survey.title)}_答卷数据.csv`);
    res.send('\ufeff' + csv);
  } catch (error) {
    console.error('导出CSV失败:', error);
    res.status(500).json({ error: '导出失败' });
  }
});

app.get('/api/survey/:id/export/pdf', authenticateToken, async (req, res) => {
  try {
    const sResult = await pool.query('SELECT * FROM surveys WHERE id = $1', [req.params.id]);
    if (!sResult.rows[0]) return res.status(404).json({ error: '问卷不存在' });
    const survey = { ...sResult.rows[0].data, id: sResult.rows[0].id, userId: sResult.rows[0].user_id };
    if (survey.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权限导出此问卷数据' });
    }
    const rResult = await pool.query('SELECT * FROM responses WHERE survey_id = $1', [req.params.id]);
    const responses = rResult.rows.map(r => ({ answers: r.answers, submittedAt: r.submitted_at }));

    let content = `问卷: ${survey.title}\n导出时间: ${new Date().toLocaleString('zh-CN')}\n答卷数量: ${responses.length}\n\n`;
    responses.forEach((r, i) => {
      content += `--- 第 ${i + 1} 份答卷 ---\n提交时间: ${new Date(r.submittedAt).toLocaleString('zh-CN')}\n`;
      survey.questions.forEach(q => {
        const answer = r.answers[q.id];
        content += `${q.title}: ${Array.isArray(answer) ? answer.join(', ') : (answer || '(未回答)')}\n`;
      });
      content += '\n';
    });
    const { jsPDF } = pdfModule;
    const doc = new jsPDF();
    const lines = doc.splitTextToSize(content, 180);
    doc.text(lines, 10, 10);
    const pdfBuffer = doc.output('arraybuffer');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(survey.title)}_答卷数据.pdf`);
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    console.error('导出PDF失败:', error);
    res.status(500).json({ error: '导出失败' });
  }
});

// ========== PDF 文本解析 ==========
function parseQuestionsFromText(text) {
  const questions = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  let currentQuestion = null;
  let pendingTitle = null;
  const numberAtEndPattern = /(.+?)\s+(\d+)[\.\t]\s*$/;
  const numberOnlyPattern = /^(\d+)[\.\t]\s*$/;
  const sectionKeywords = ['准备篇', '基本信息', '仪式感', '羞耻调教', '进阶篇', '匿名', '完成时间', '感谢', '谢谢', '提交'];
  const skipPatterns = [/^第\s*\d+\s*页$/, /^页码$/, /^共\d+页$/, /^[\s]*$/, /^[-=*_]{5,}$/, /^--\s*\d+\s*of\s*\d+\s*--$/];
  const isOption = (line) => {
    if (/^\d+[\.\t]/.test(line)) return false;
    if (/\s+\d+[\.\t]/.test(line)) return false;
    if (line.includes('*')) return false;
    return line.length > 3 && line.length < 50;
  };
  const isSectionTitle = (line) => sectionKeywords.some(k => line.includes(k));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (skipPatterns.some(p => p.test(line))) continue;
    if (line.length < 2) continue;
    if (isSectionTitle(line)) continue;

    let match, title = '', number = 0;
    match = line.match(numberAtEndPattern);
    if (match) {
      title = match[1].trim().replace(/\s*\*+\s*/g, '');
      number = parseInt(match[2]);
    } else if (numberOnlyPattern.test(line)) {
      if (pendingTitle) {
        title = pendingTitle;
        number = parseInt(line.match(numberOnlyPattern)[1]);
        pendingTitle = null;
      }
    } else {
      if (!currentQuestion || currentQuestion.title) {
        if (currentQuestion && currentQuestion.title && isOption(line)) {
          if (!currentQuestion.options) currentQuestion.options = [];
          currentQuestion.options.push(line);
          continue;
        }
        pendingTitle = line.replace(/\s*\*+\s*/g, '');
        continue;
      }
    }

    if (title && title.length > 0) {
      if (currentQuestion && currentQuestion.title) {
        currentQuestion.type = (currentQuestion.options && currentQuestion.options.length >= 2) ? 'singleChoice' : 'text';
        if (currentQuestion.type === 'text') currentQuestion.options = undefined;
        questions.push(currentQuestion);
      }
      currentQuestion = {
        id: `q_${Date.now()}_${questions.length}`,
        title,
        type: 'text',
        required: line.includes('*'),
        options: []
      };
      continue;
    }
    if (currentQuestion && currentQuestion.title && isOption(line)) {
      if (!currentQuestion.options) currentQuestion.options = [];
      currentQuestion.options.push(line);
    }
  }
  if (currentQuestion && currentQuestion.title) {
    currentQuestion.type = (currentQuestion.options && currentQuestion.options.length >= 2) ? 'singleChoice' : 'text';
    if (currentQuestion.type === 'text') currentQuestion.options = undefined;
    questions.push(currentQuestion);
  }
  return questions.filter(q => q.title && q.title.length > 0);
}

// ========== 访客日志记录中间件 ==========
app.use((req, res, next) => {
  // 仅记录 GET 页面请求，排除静态资源和健康检查
  if (req.method === 'GET' && !req.path.startsWith('/uploads') && !req.path.startsWith('/api/')) {
    const userId = req.user ? req.user.id : null;
    const username = req.user ? req.user.username : null;
    pool.query(
      'INSERT INTO visit_logs (user_id, username, path, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
      [userId, username, req.path, req.ip, req.headers['user-agent']]
    ).catch(() => {});
  }
  next();
});

// ========== 网站设置 API ==========

// 获取站点设置（公开）
app.get('/api/site-settings', async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'siteSettings'");
    const settings = result.rows[0] ? result.rows[0].value : {};
    // 公开接口返回所有前台展示所需字段
    res.json({
      siteName: settings.siteName || '我的个人空间',
      siteSubtitle: settings.siteSubtitle || '',
      loginBg: settings.loginBg || '',
      sidebarLogo: settings.sidebarLogo || '',
      heroBanner: settings.heroBanner || '',
      registerMode: settings.registerMode || 'open',
      menuLabels: settings.menuLabels || {},
      moduleIcons: settings.moduleIcons || {},
      heroTitleStyle: settings.heroTitleStyle || {},
      marqueeConfig: settings.marqueeConfig || {},
      moduleImages: settings.moduleImages || {},
      homePageStyle: settings.homePageStyle || {},
    });
  } catch (error) {
    res.status(500).json({ error: '获取站点设置失败' });
  }
});

// 获取完整站点设置（管理员）
app.get('/api/admin/site-settings', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'siteSettings'");
    res.json(result.rows[0] ? result.rows[0].value : {});
  } catch (error) {
    res.status(500).json({ error: '获取站点设置失败' });
  }
});

// 更新站点设置（管理员）
app.put('/api/admin/site-settings', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      ['siteSettings', JSON.stringify(req.body)]
    );
    res.json({ message: '站点设置已更新', settings: req.body });
  } catch (error) {
    res.status(500).json({ error: '更新站点设置失败' });
  }
});

// 上传图片（管理员用，限制大小5MB）
const imageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, 'uploads', 'site');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('只允许上传图片'));
  }
});

app.post('/api/admin/upload-image', authenticateToken, imageUpload.single('image'), (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  if (!req.file) return res.status(400).json({ error: '没有上传文件' });
  res.json({ url: `/uploads/site/${req.file.filename}` });
});

// ========== 用户分组 API ==========

// 获取所有分组
app.get('/api/admin/groups', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    const result = await pool.query('SELECT * FROM user_groups ORDER BY created_at ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: '获取分组失败' });
  }
});

// 创建分组
app.post('/api/admin/groups', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    const { name, description, color } = req.body;
    if (!name) return res.status(400).json({ error: '分组名称不能为空' });
    const id = nanoid(10);
    const result = await pool.query(
      'INSERT INTO user_groups (id, name, description, color) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, name, description || '', color || '#1890ff']
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: '创建分组失败' });
  }
});

// 更新分组
app.put('/api/admin/groups/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    const { name, description, color } = req.body;
    const result = await pool.query(
      'UPDATE user_groups SET name=$1, description=$2, color=$3 WHERE id=$4 RETURNING *',
      [name, description || '', color || '#1890ff', req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: '分组不存在' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: '更新分组失败' });
  }
});

// 删除分组
app.delete('/api/admin/groups/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    await pool.query('DELETE FROM user_groups WHERE id=$1', [req.params.id]);
    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: '删除分组失败' });
  }
});

// ========== 用户管理 API ==========

// 获取所有用户（管理员，支持筛选）
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    const {
      status, role, gender, marital_status, education, income_range,
      province, city, search, group_id, profile_completed,
      sort_by = 'created_at', sort_order = 'desc',
      page = 1, page_size = 50
    } = req.query;

    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    // 构建筛选条件
    if (status) {
      whereConditions.push(`u.status = $${paramIndex++}`);
      params.push(status);
    }
    if (role) {
      whereConditions.push(`u.role = $${paramIndex++}`);
      params.push(role);
    }
    if (gender) {
      whereConditions.push(`p.gender = $${paramIndex++}`);
      params.push(gender);
    }
    if (marital_status) {
      whereConditions.push(`p.marital_status = $${paramIndex++}`);
      params.push(marital_status);
    }
    if (education) {
      whereConditions.push(`p.education = $${paramIndex++}`);
      params.push(education);
    }
    if (income_range) {
      whereConditions.push(`p.income_range = $${paramIndex++}`);
      params.push(income_range);
    }
    if (province) {
      whereConditions.push(`p.province LIKE $${paramIndex++}`);
      params.push(`%${province}%`);
    }
    if (city) {
      whereConditions.push(`p.city LIKE $${paramIndex++}`);
      params.push(`%${city}%`);
    }
    if (search) {
      whereConditions.push(`(u.username LIKE $${paramIndex} OR u.email LIKE $${paramIndex} OR p.nickname LIKE $${paramIndex} OR p.phone LIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (group_id) {
      whereConditions.push(`u.group_ids::text LIKE $${paramIndex++}`);
      params.push(`%"${group_id}"%`);
    }
    if (profile_completed !== undefined) {
      whereConditions.push(`p.profile_completed = $${paramIndex++}`);
      params.push(profile_completed === 'true');
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // 排序
    const sortColumn = ['username', 'email', 'created_at', 'status', 'gender', 'age', 'province'].includes(sort_by)
      ? sort_by === 'created_at' ? 'u.created_at' : sort_by === 'username' ? 'u.username' : sort_by === 'email' ? 'u.email' : sort_by === 'status' ? 'u.status' : `p.${sort_by}`
      : 'u.created_at';
    const sortDirection = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // 分页
    const pageNum = parseInt(page);
    const pageSize = Math.min(parseInt(page_size), 100);
    const offset = (pageNum - 1) * pageSize;

    // 查询总数
    const countResult = await pool.query(`
      SELECT COUNT(*) as total
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      ${whereClause}
    `, params);
    const total = parseInt(countResult.rows[0].total);

    // 查询数据
    const result = await pool.query(`
      SELECT
        u.id, u.username, u.email, u.role, u.status, u.group_ids, u.avatar, u.created_at,
        p.nickname, p.gender, p.age, p.birthday, p.occupation, p.marital_status,
        p.province, p.city, p.district, p.phone, p.wechat, p.qq, p.bio,
        p.hobbies, p.interests, p.education, p.income_range,
        p.avatar_url, p.profile_completed
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDirection}
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, [...params, pageSize, offset]);

    res.json({
      users: result.rows,
      total,
      page: pageNum,
      page_size: pageSize,
      total_pages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 获取单个用户详情（管理员）
app.get('/api/admin/users/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    const userResult = await pool.query(
      'SELECT id, username, email, role, status, group_ids, avatar, created_at FROM users WHERE id = $1',
      [req.params.id]
    );
    if (!userResult.rows[0]) return res.status(404).json({ error: '用户不存在' });

    const profileResult = await pool.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [req.params.id]
    );

    res.json({
      ...userResult.rows[0],
      ...(profileResult.rows[0] || {})
    });
  } catch (error) {
    res.status(500).json({ error: '获取用户详情失败' });
  }
});

// 导出会员信息（管理员）
app.get('/api/admin/users/export', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    const { format = 'csv', status, gender, province, city, search } = req.query;

    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    if (status) {
      whereConditions.push(`u.status = $${paramIndex++}`);
      params.push(status);
    }
    if (gender) {
      whereConditions.push(`p.gender = $${paramIndex++}`);
      params.push(gender);
    }
    if (province) {
      whereConditions.push(`p.province LIKE $${paramIndex++}`);
      params.push(`%${province}%`);
    }
    if (city) {
      whereConditions.push(`p.city LIKE $${paramIndex++}`);
      params.push(`%${city}%`);
    }
    if (search) {
      whereConditions.push(`(u.username LIKE $${paramIndex} OR u.email LIKE $${paramIndex} OR p.nickname LIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    const result = await pool.query(`
      SELECT
        u.username, u.email, u.role, u.status, u.created_at,
        p.nickname, p.gender, p.age, p.birthday, p.occupation, p.marital_status,
        p.province, p.city, p.phone, p.wechat, p.qq, p.bio,
        p.education, p.income_range
      FROM users u
      LEFT JOIN user_profiles p ON u.id = p.user_id
      ${whereClause}
      ORDER BY u.created_at DESC
    `, params);

    if (format === 'json') {
      res.json(result.rows);
    } else {
      // CSV 格式
      const headers = ['用户名', '邮箱', '角色', '状态', '注册时间', '昵称', '性别', '年龄', '生日', '职业', '婚姻状况', '省份', '城市', '电话', '微信', 'QQ', '简介', '学历', '收入'];
      const escapeCSV = (str) => {
        if (str == null) return '';
        const s = String(str);
        return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      let csv = headers.map(escapeCSV).join(',') + '\n';
      result.rows.forEach(row => {
        const rowData = [
          row.username, row.email, row.role, row.status, row.created_at,
          row.nickname, row.gender, row.age, row.birthday, row.occupation, row.marital_status,
          row.province, row.city, row.phone, row.wechat, row.qq, row.bio,
          row.education, row.income_range
        ];
        csv += rowData.map(escapeCSV).join(',') + '\n';
      });
      res.setHeader('Content-Type', 'text/csv;charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=users_export_${Date.now()}.csv`);
      res.send('\ufeff' + csv);
    }
  } catch (error) {
    console.error('导出用户数据失败:', error);
    res.status(500).json({ error: '导出失败' });
  }
});

// 审批用户（通过/拒绝）
app.put('/api/admin/users/:id/status', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    const { status } = req.body; // active | banned | pending
    const result = await pool.query(
      'UPDATE users SET status=$1 WHERE id=$2 RETURNING id, username, status',
      [status, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: '用户不存在' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: '更新用户状态失败' });
  }
});

// 设置用户分组
app.put('/api/admin/users/:id/groups', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    const { groupIds } = req.body;
    const result = await pool.query(
      'UPDATE users SET group_ids=$1 WHERE id=$2 RETURNING id, username, group_ids',
      [JSON.stringify(groupIds || []), req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: '用户不存在' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: '更新用户分组失败' });
  }
});

// 删除用户（管理员）
app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  if (req.params.id === req.user.id) return res.status(400).json({ error: '不能删除自己' });
  try {
    await pool.query('DELETE FROM users WHERE id=$1', [req.params.id]);
    res.json({ message: '用户已删除' });
  } catch (error) {
    res.status(500).json({ error: '删除用户失败' });
  }
});

// ========== 邀请码 API ==========

// 获取邀请码列表（管理员）
app.get('/api/admin/invite-codes', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    const result = await pool.query('SELECT * FROM invite_codes ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: '获取邀请码失败' });
  }
});

// 创建邀请码
app.post('/api/admin/invite-codes', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    const { note, maxUses, expiresAt } = req.body;
    const id = nanoid(10);
    const code = nanoid(8).toUpperCase();
    const result = await pool.query(
      'INSERT INTO invite_codes (id, code, note, max_uses, expires_at) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id, code, note || '', maxUses || 1, expiresAt || null]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: '创建邀请码失败' });
  }
});

// 禁用/启用邀请码
app.put('/api/admin/invite-codes/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    const { isActive } = req.body;
    const result = await pool.query(
      'UPDATE invite_codes SET is_active=$1 WHERE id=$2 RETURNING *',
      [isActive, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: '更新邀请码失败' });
  }
});

// 删除邀请码
app.delete('/api/admin/invite-codes/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    await pool.query('DELETE FROM invite_codes WHERE id=$1', [req.params.id]);
    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: '删除邀请码失败' });
  }
});

// ========== 资源库 API ==========

// 检查资源访问权限的辅助函数
async function checkResourceAccess(accessType, allowedGroupIds, userId, userRole) {
  if (userRole === 'admin') return true;
  if (accessType === 'public') return true;
  if (!userId) return false;
  if (accessType === 'members') return true;
  if (accessType === 'groups') {
    if (!allowedGroupIds || allowedGroupIds.length === 0) return false;
    const result = await pool.query('SELECT group_ids FROM users WHERE id=$1', [userId]);
    if (!result.rows[0]) return false;
    const userGroups = result.rows[0].group_ids || [];
    return allowedGroupIds.some(gid => userGroups.includes(gid));
  }
  return false;
}

// 获取资源文件夹列表
app.get('/api/resource-folders', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM resource_folders ORDER BY sort_order ASC, created_at DESC');
    const userId = req.user ? req.user.id : null;
    const userRole = req.user ? req.user.role : null;

    const accessible = await Promise.all(result.rows.map(async (folder) => {
      const hasAccess = await checkResourceAccess(folder.access_type, folder.allowed_group_ids, userId, userRole);
      if (!hasAccess) return null;
      return folder;
    }));
    res.json(accessible.filter(Boolean));
  } catch (error) {
    res.status(500).json({ error: '获取资源文件夹失败' });
  }
});

// 创建资源文件夹（管理员）
app.post('/api/admin/resource-folders', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    const { name, description, accessType, allowedGroupIds } = req.body;
    if (!name) return res.status(400).json({ error: '文件夹名称不能为空' });
    const id = nanoid(10);
    const result = await pool.query(
      'INSERT INTO resource_folders (id, name, description, access_type, allowed_group_ids) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [id, name, description || '', accessType || 'members', JSON.stringify(allowedGroupIds || [])]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: '创建文件夹失败' });
  }
});

// 更新资源文件夹（管理员）
app.put('/api/admin/resource-folders/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    const { name, description, accessType, allowedGroupIds, coverImage } = req.body;
    const result = await pool.query(
      'UPDATE resource_folders SET name=$1, description=$2, access_type=$3, allowed_group_ids=$4, cover_image=$5, updated_at=NOW() WHERE id=$6 RETURNING *',
      [name, description || '', accessType || 'members', JSON.stringify(allowedGroupIds || []), coverImage || null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: '文件夹不存在' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: '更新文件夹失败' });
  }
});

// 删除资源文件夹（管理员）
app.delete('/api/admin/resource-folders/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    await pool.query('DELETE FROM resource_files WHERE folder_id=$1', [req.params.id]);
    await pool.query('DELETE FROM resource_folders WHERE id=$1', [req.params.id]);
    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: '删除文件夹失败' });
  }
});

// 获取文件夹内的文件
app.get('/api/resource-folders/:id/files', optionalAuth, async (req, res) => {
  try {
    const folderResult = await pool.query('SELECT * FROM resource_folders WHERE id=$1', [req.params.id]);
    if (!folderResult.rows[0]) return res.status(404).json({ error: '文件夹不存在' });
    const folder = folderResult.rows[0];
    const userId = req.user ? req.user.id : null;
    const userRole = req.user ? req.user.role : null;
    const hasAccess = await checkResourceAccess(folder.access_type, folder.allowed_group_ids, userId, userRole);
    if (!hasAccess) return res.status(403).json({ error: '无权限访问此文件夹' });

    const result = await pool.query('SELECT * FROM resource_files WHERE folder_id=$1 ORDER BY sort_order ASC, created_at DESC', [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: '获取文件列表失败' });
  }
});

// 上传文件到资源文件夹（管理员）
const resourceUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, 'uploads', 'resources');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 50 * 1024 * 1024 }
});

app.post('/api/admin/resource-folders/:id/files', authenticateToken, resourceUpload.single('file'), async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  if (!req.file) return res.status(400).json({ error: '没有上传文件' });
  try {
    const id = nanoid(10);
    const result = await pool.query(
      'INSERT INTO resource_files (id, folder_id, name, original_name, file_path, file_type, file_size, description) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [id, req.params.id, req.file.filename, req.file.originalname, `/uploads/resources/${req.file.filename}`, req.file.mimetype, req.file.size, req.body.description || '']
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: '上传文件失败' });
  }
});

// 删除资源文件（管理员）
app.delete('/api/admin/resource-files/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    const result = await pool.query('SELECT * FROM resource_files WHERE id=$1', [req.params.id]);
    if (result.rows[0]) {
      const filePath = path.join(__dirname, result.rows[0].file_path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await pool.query('DELETE FROM resource_files WHERE id=$1', [req.params.id]);
    }
    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: '删除文件失败' });
  }
});

// ========== 公告 API ==========

// 获取公告列表（会员可见）
app.get('/api/announcements', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM announcements ORDER BY is_pinned DESC, created_at DESC');
    const userId = req.user ? req.user.id : null;
    const userRole = req.user ? req.user.role : null;

    if (userRole === 'admin') return res.json(result.rows);

    const accessible = await Promise.all(result.rows.map(async (ann) => {
      if (ann.target_type === 'all') return ann;
      if (!userId) return null;
      if (ann.target_type === 'members') return ann;
      if (ann.target_type === 'groups') {
        const uResult = await pool.query('SELECT group_ids FROM users WHERE id=$1', [userId]);
        if (!uResult.rows[0]) return null;
        const userGroups = uResult.rows[0].group_ids || [];
        const targetGroups = ann.target_group_ids || [];
        if (targetGroups.some(gid => userGroups.includes(gid))) return ann;
        return null;
      }
      return null;
    }));
    res.json(accessible.filter(Boolean));
  } catch (error) {
    res.status(500).json({ error: '获取公告失败' });
  }
});

// 创建公告（管理员）
app.post('/api/admin/announcements', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    const { title, content, targetType, targetGroupIds, isPinned } = req.body;
    if (!title || !content) return res.status(400).json({ error: '标题和内容不能为空' });
    const id = nanoid(10);
    const result = await pool.query(
      'INSERT INTO announcements (id, title, content, target_type, target_group_ids, is_pinned) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [id, title, content, targetType || 'all', JSON.stringify(targetGroupIds || []), isPinned || false]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: '创建公告失败' });
  }
});

// 更新公告（管理员）
app.put('/api/admin/announcements/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    const { title, content, targetType, targetGroupIds, isPinned } = req.body;
    const result = await pool.query(
      'UPDATE announcements SET title=$1, content=$2, target_type=$3, target_group_ids=$4, is_pinned=$5, updated_at=NOW() WHERE id=$6 RETURNING *',
      [title, content, targetType || 'all', JSON.stringify(targetGroupIds || []), isPinned || false, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: '公告不存在' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: '更新公告失败' });
  }
});

// 删除公告（管理员）
app.delete('/api/admin/announcements/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    await pool.query('DELETE FROM announcements WHERE id=$1', [req.params.id]);
    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: '删除公告失败' });
  }
});

// ========== 私信 API ==========

// 获取与管理员的对话列表（管理员看所有用户的对话）
app.get('/api/messages', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'admin') {
      // 管理员获取所有有私信的用户列表（按最后消息时间）
      const result = await pool.query(`
        SELECT DISTINCT ON (CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END)
          CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END as user_id,
          u.username,
          m.content as last_message,
          m.created_at as last_time,
          (SELECT COUNT(*) FROM messages WHERE receiver_id = $1 AND sender_id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AND is_read = false) as unread_count
        FROM messages m
        JOIN users u ON u.id = CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
        WHERE m.sender_id = $1 OR m.receiver_id = $1
        ORDER BY CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END, m.created_at DESC
      `, [req.user.id]);
      return res.json(result.rows);
    }
    // 普通用户获取与管理员的对话
    const adminResult = await pool.query("SELECT id FROM users WHERE role='admin' LIMIT 1");
    if (!adminResult.rows[0]) return res.json([]);
    const adminId = adminResult.rows[0].id;
    const result = await pool.query(
      'SELECT * FROM messages WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1) ORDER BY created_at ASC',
      [req.user.id, adminId]
    );
    // 标记已读
    await pool.query('UPDATE messages SET is_read=true WHERE receiver_id=$1 AND sender_id=$2', [req.user.id, adminId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: '获取消息失败' });
  }
});

// 获取与指定用户的对话（管理员）
app.get('/api/messages/:userId', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT m.*, u.username as sender_name FROM messages m JOIN users u ON u.id = m.sender_id WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1) ORDER BY created_at ASC',
      [req.user.id, req.params.userId]
    );
    // 标记已读
    await pool.query('UPDATE messages SET is_read=true WHERE receiver_id=$1 AND sender_id=$2', [req.user.id, req.params.userId]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: '获取消息失败' });
  }
});

// 发送私信
app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: '消息内容不能为空' });

    let targetReceiverId = receiverId;
    // 普通用户只能发给管理员
    if (req.user.role !== 'admin') {
      const adminResult = await pool.query("SELECT id FROM users WHERE role='admin' LIMIT 1");
      if (!adminResult.rows[0]) return res.status(404).json({ error: '管理员不存在' });
      targetReceiverId = adminResult.rows[0].id;
    }

    const id = nanoid(10);
    const result = await pool.query(
      'INSERT INTO messages (id, sender_id, receiver_id, content) VALUES ($1,$2,$3,$4) RETURNING *',
      [id, req.user.id, targetReceiverId, content.trim()]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: '发送消息失败' });
  }
});

// 获取未读消息数量
app.get('/api/messages/unread/count', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM messages WHERE receiver_id=$1 AND is_read=false', [req.user.id]);
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    res.status(500).json({ error: '获取未读数量失败' });
  }
});

// ========== 访客统计 API ==========

// 获取访客统计（管理员）
app.get('/api/admin/visit-stats', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    const { days = 7 } = req.query;
    // 每日访问量
    const dailyResult = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM visit_logs
      WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    // 活跃用户
    const activeUsersResult = await pool.query(`
      SELECT username, COUNT(*) as visit_count, MAX(created_at) as last_visit
      FROM visit_logs
      WHERE created_at > NOW() - INTERVAL '${parseInt(days)} days' AND username IS NOT NULL
      GROUP BY username
      ORDER BY visit_count DESC
      LIMIT 20
    `);
    // 总计
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM visit_logs');
    const todayResult = await pool.query("SELECT COUNT(*) as today FROM visit_logs WHERE DATE(created_at) = CURRENT_DATE");
    // 最近访客记录
    const recentResult = await pool.query('SELECT * FROM visit_logs ORDER BY created_at DESC LIMIT 50');

    res.json({
      daily: dailyResult.rows,
      activeUsers: activeUsersResult.rows,
      total: parseInt(totalResult.rows[0].total),
      today: parseInt(todayResult.rows[0].today),
      recent: recentResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

// ========== 相册 API ==========

// 获取相册列表
app.get('/api/albums', optionalAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM albums ORDER BY sort_order ASC, created_at DESC');
    const userId = req.user ? req.user.id : null;
    const userRole = req.user ? req.user.role : null;

    const accessible = await Promise.all(result.rows.map(async (album) => {
      const hasAccess = await checkResourceAccess(album.access_type, album.allowed_group_ids, userId, userRole);
      if (!hasAccess) return null;
      // 获取照片数量
      const countResult = await pool.query('SELECT COUNT(*) FROM album_photos WHERE album_id=$1', [album.id]);
      return { ...album, photoCount: parseInt(countResult.rows[0].count) };
    }));
    res.json(accessible.filter(Boolean));
  } catch (error) {
    res.status(500).json({ error: '获取相册失败' });
  }
});

// 获取相册详情 + 照片
app.get('/api/albums/:id', optionalAuth, async (req, res) => {
  try {
    const albumResult = await pool.query('SELECT * FROM albums WHERE id=$1', [req.params.id]);
    if (!albumResult.rows[0]) return res.status(404).json({ error: '相册不存在' });
    const album = albumResult.rows[0];
    const userId = req.user ? req.user.id : null;
    const userRole = req.user ? req.user.role : null;
    const hasAccess = await checkResourceAccess(album.access_type, album.allowed_group_ids, userId, userRole);
    if (!hasAccess) return res.status(403).json({ error: '无权限访问此相册' });

    const photosResult = await pool.query('SELECT * FROM album_photos WHERE album_id=$1 ORDER BY sort_order ASC, created_at DESC', [req.params.id]);
    res.json({ ...album, photos: photosResult.rows });
  } catch (error) {
    res.status(500).json({ error: '获取相册详情失败' });
  }
});

// 创建相册（管理员）
app.post('/api/admin/albums', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    const { name, description, accessType, allowedGroupIds } = req.body;
    if (!name) return res.status(400).json({ error: '相册名称不能为空' });
    const id = nanoid(10);
    const result = await pool.query(
      'INSERT INTO albums (id, name, description, access_type, allowed_group_ids) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [id, name, description || '', accessType || 'members', JSON.stringify(allowedGroupIds || [])]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: '创建相册失败' });
  }
});

// 更新相册（管理员）
app.put('/api/admin/albums/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    const { name, description, accessType, allowedGroupIds, coverImage } = req.body;
    const result = await pool.query(
      'UPDATE albums SET name=$1, description=$2, access_type=$3, allowed_group_ids=$4, cover_image=$5, updated_at=NOW() WHERE id=$6 RETURNING *',
      [name, description || '', accessType || 'members', JSON.stringify(allowedGroupIds || []), coverImage || null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: '相册不存在' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: '更新相册失败' });
  }
});

// 删除相册（管理员）
app.delete('/api/admin/albums/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    const photos = await pool.query('SELECT file_path FROM album_photos WHERE album_id=$1', [req.params.id]);
    photos.rows.forEach(p => {
      const fp = path.join(__dirname, p.file_path);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    });
    await pool.query('DELETE FROM album_photos WHERE album_id=$1', [req.params.id]);
    await pool.query('DELETE FROM albums WHERE id=$1', [req.params.id]);
    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: '删除相册失败' });
  }
});

// 上传照片到相册（管理员）
const photoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, 'uploads', 'albums');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('只允许上传图片'));
  }
});

app.post('/api/admin/albums/:id/photos', authenticateToken, photoUpload.array('photos', 20), async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: '没有上传照片' });
  try {
    const inserted = [];
    for (const file of req.files) {
      const id = nanoid(10);
      const result = await pool.query(
        'INSERT INTO album_photos (id, album_id, name, file_path) VALUES ($1,$2,$3,$4) RETURNING *',
        [id, req.params.id, file.originalname, `/uploads/albums/${file.filename}`]
      );
      inserted.push(result.rows[0]);
    }
    // 更新相册封面（取第一张）
    const coverResult = await pool.query('SELECT file_path FROM album_photos WHERE album_id=$1 ORDER BY created_at ASC LIMIT 1', [req.params.id]);
    if (coverResult.rows[0]) {
      await pool.query('UPDATE albums SET cover_image=$1 WHERE id=$2 AND cover_image IS NULL', [coverResult.rows[0].file_path, req.params.id]);
    }
    res.json(inserted);
  } catch (error) {
    res.status(500).json({ error: '上传照片失败' });
  }
});

// 删除照片（管理员）
app.delete('/api/admin/album-photos/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  try {
    const result = await pool.query('SELECT * FROM album_photos WHERE id=$1', [req.params.id]);
    if (result.rows[0]) {
      const fp = path.join(__dirname, result.rows[0].file_path);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
      await pool.query('DELETE FROM album_photos WHERE id=$1', [req.params.id]);
    }
    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: '删除照片失败' });
  }
});

app.use('/uploads/resources', express.static(path.join(__dirname, 'uploads', 'resources')));
app.use('/uploads/albums', express.static(path.join(__dirname, 'uploads', 'albums')));
app.use('/uploads/site', express.static(path.join(__dirname, 'uploads', 'site')));
app.use('/uploads/avatars', express.static(path.join(__dirname, 'uploads', 'avatars')));

app.listen(PORT, () => {
  console.log(`问卷系统后端服务运行在 http://localhost:${PORT}`);
});

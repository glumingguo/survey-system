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
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
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
    const { username, email, password } = req.body;
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
      const dup = existing.rows[0];
      return res.status(400).json({ error: '用户名或邮箱已存在' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // 唯一管理员：S驯养灵魂 自动设为 admin
    const role = username === 'S驯养灵魂' ? 'admin' : 'user';
    const id = nanoid(10);

    await pool.query(
      'INSERT INTO users (id, username, email, password, role) VALUES ($1, $2, $3, $4, $5)',
      [id, username, email, hashedPassword, role]
    );

    const token = jwt.sign({ id, username, role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      message: '注册成功',
      token,
      user: { id, username, email, role }
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

app.listen(PORT, () => {
  console.log(`问卷系统后端服务运行在 http://localhost:${PORT}`);
});

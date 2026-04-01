const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const { nanoid } = require('nanoid');
const QRCode = require('qrcode');
const { PDFParse } = require('pdf-parse');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// 同步加载nodemailer
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

// JWT 密钥（生产环境应使用环境变量）
const JWT_SECRET = process.env.JWT_SECRET || 'survey-system-secret-key-2024';

function createTransporter(config) {
  if (!nodemailerModule) {
    throw new Error('nodemailer模块未正确加载，请检查安装');
  }
  // nodemailer 6.x 使用 createTransport，5.x 使用 createTransporter
  const createFn = nodemailerModule.createTransport || nodemailerModule.createTransporter;
  if (!createFn) {
    throw new Error('nodemailer版本不支持，请检查安装');
  }
  return createFn.call(nodemailerModule, config);
}

const app = express();
// Railway 会注入 PORT 环境变量
const PORT = process.env.PORT || 3002;

// 中间件配置
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB 限制
});

// 数据库配置
const dbFile = path.join(__dirname, 'data', 'db.json');
const dataDir = path.dirname(dbFile);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 初始化数据库结构
const defaultData = {
  surveys: [],
  responses: [],
  users: [],
  settings: {
    emailConfig: {
      enabled: true,
      host: '',
      port: 587,
      secure: false,
      user: '',
      pass: '',
      fromEmail: '',
      fromName: '',
      to: ''
    }
  }
};

const adapter = new JSONFile(dbFile);
const db = new Low(adapter, defaultData);

async function initDB() {
  await db.read();
  db.data = db.data || defaultData;
  await db.write();
}

initDB();

// ========== 认证中间件 ==========
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '需要登录才能访问' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '登录已过期，请重新登录' });
    }
    req.user = user;
    next();
  });
}

// 可选认证中间件（不强制登录）
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (!err) {
        req.user = user;
      }
    });
  }
  next();
}

// ========== 用户认证 API ==========

// 用户注册
app.post('/api/auth/register', async (req, res) => {
  try {
    await db.read();
    const { username, email, password } = req.body;

    // 验证必填项
    if (!username || !email || !password) {
      return res.status(400).json({ error: '用户名、邮箱和密码不能为空' });
    }

    // 检查用户名是否已存在
    if (db.data.users.find(u => u.username === username)) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    // 检查邮箱是否已存在
    if (db.data.users.find(u => u.email === email)) {
      return res.status(400).json({ error: '邮箱已被注册' });
    }

    // 密码强度检查
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少需要6个字符' });
    }

    // 密码哈希
    const hashedPassword = await bcrypt.hash(password, 10);

    // 唯一管理员检查：s驯养灵魂 自动设为管理员
    const isAdmin = username === 's驯养灵魂' ? 'admin' : 'user';

    const user = {
      id: nanoid(10),
      username,
      email,
      password: hashedPassword,
      role: isAdmin, // user 或 admin
      createdAt: new Date().toISOString()
    };

    db.data.users.push(user);
    await db.write();

    // 生成 Token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: '注册成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

// 用户登录
app.post('/api/auth/login', async (req, res) => {
  try {
    await db.read();
    const { username, password } = req.body;

    // 验证必填项
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    // 查找用户（支持用户名或邮箱登录）
    const user = db.data.users.find(
      u => u.username === username || u.email === username
    );

    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 验证密码
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 唯一管理员检查：s驯养灵魂 自动设为管理员
    if (username === 's驯养灵魂' && user.role !== 'admin') {
      user.role = 'admin';
      await db.write();
    }

    // 生成 Token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: '登录成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

// 获取当前用户信息
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    await db.read();
    const user = db.data.users.find(u => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    });
  } catch (error) {
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// 修改密码
app.put('/api/auth/password', authenticateToken, async (req, res) => {
  try {
    await db.read();
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '请填写所有字段' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码至少需要6个字符' });
    }

    const user = db.data.users.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const validPassword = await bcrypt.compare(oldPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: '原密码错误' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await db.write();

    res.json({ message: '密码修改成功' });
  } catch (error) {
    res.status(500).json({ error: '修改密码失败' });
  }
});

// ===== 管理员设置接口 =====
// 设置唯一管理员（先移除所有管理员，再设置新管理员）
app.post('/api/admin/set-admin', async (req, res) => {
  try {
    await db.read();
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ error: '请提供用户名' });
    }
    
    // 移除所有现有管理员
    db.data.users.forEach(u => {
      if (u.role === 'admin') {
        u.role = 'user';
      }
    });
    
    const user = db.data.users.find(u => u.username === username);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    user.role = 'admin';
    await db.write();
    
    res.json({ message: `用户 ${username} 已设为唯一管理员` });
  } catch (error) {
    res.status(500).json({ error: '设置失败' });
  }
});

// API 路由

// 1. 问卷管理
app.get('/api/surveys', async (req, res) => {
  try {
    await db.read();
    res.json(db.data.surveys);
  } catch (error) {
    res.status(500).json({ error: '获取问卷列表失败' });
  }
});

app.get('/api/surveys/:id', optionalAuth, async (req, res) => {
  try {
    await db.read();
    const survey = db.data.surveys.find(s => s.id === req.params.id);
    if (!survey) {
      return res.status(404).json({ error: '问卷不存在' });
    }
    
    // 如果用户已登录，检查是否为创建者
    const isOwner = req.user && (survey.userId === req.user.id || req.user.role === 'admin');
    
    // 返回问卷信息，隐藏敏感的 userId（除非是创建者）
    const responseData = {
      ...survey,
      isOwner: isOwner // 添加所有者标记，供前端使用
    };
    
    res.json(responseData);
  } catch (error) {
    res.status(500).json({ error: '获取问卷详情失败' });
  }
});

app.post('/api/surveys', authenticateToken, async (req, res) => {
  try {
    await db.read();
    const survey = {
      id: nanoid(10),
      ...req.body,
      userId: req.user.id, // 关联创建者
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.data.surveys.push(survey);
    await db.write();
    res.json(survey);
  } catch (error) {
    res.status(500).json({ error: '创建问卷失败' });
  }
});

app.put('/api/surveys/:id', authenticateToken, async (req, res) => {
  try {
    await db.read();
    const index = db.data.surveys.findIndex(s => s.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: '问卷不存在' });
    }
    const survey = db.data.surveys[index];
    
    // 检查权限：只有创建者或管理员可以修改
    if (survey.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权限修改此问卷' });
    }
    
    db.data.surveys[index] = {
      ...survey,
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    await db.write();
    res.json(db.data.surveys[index]);
  } catch (error) {
    res.status(500).json({ error: '更新问卷失败' });
  }
});

app.delete('/api/surveys/:id', authenticateToken, async (req, res) => {
  try {
    await db.read();
    const index = db.data.surveys.findIndex(s => s.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: '问卷不存在' });
    }
    const survey = db.data.surveys[index];
    
    // 检查权限：只有创建者或管理员可以删除
    if (survey.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权限删除此问卷' });
    }
    
    db.data.surveys.splice(index, 1);
    await db.write();
    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: '删除问卷失败' });
  }
});

// 获取我的问卷列表
app.get('/api/surveys/my', authenticateToken, async (req, res) => {
  try {
    await db.read();
    const surveys = db.data.surveys.filter(s => s.userId === req.user.id);
    res.json(surveys);
  } catch (error) {
    res.status(500).json({ error: '获取问卷列表失败' });
  }
});

// 2. 问卷响应管理
app.get('/api/surveys/:id/responses', async (req, res) => {
  try {
    await db.read();
    const responses = db.data.responses.filter(r => r.surveyId === req.params.id);
    res.json(responses);
  } catch (error) {
    res.status(500).json({ error: '获取答卷列表失败' });
  }
});

app.post('/api/surveys/:id/responses', upload.array('files'), async (req, res) => {
  try {
    await db.read();
    const files = req.files ? req.files.map(file => ({
      name: file.originalname,
      path: `/uploads/${file.filename}`,
      size: file.size,
      type: file.mimetype
    })) : [];
    
    const response = {
      id: nanoid(10),
      surveyId: req.params.id,
      answers: req.body.answers ? JSON.parse(req.body.answers) : req.body,
      files: files,
      submittedAt: new Date().toISOString(),
      ipAddress: req.ip
    };
    db.data.responses.push(response);
    await db.write();
    
    // 生成并发送 PDF（如果配置了邮件）
    await sendPDF(response);
    
    res.json(response);
  } catch (error) {
    console.error('提交答卷失败:', error);
    res.status(500).json({ error: '提交答卷失败' });
  }
});

// 3. 统计分析（需要认证）
app.get('/api/surveys/:id/statistics', authenticateToken, async (req, res) => {
  try {
    await db.read();
    const survey = db.data.surveys.find(s => s.id === req.params.id);
    
    // 检查权限
    if (survey.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权限查看此问卷统计' });
    }
    
    const responses = db.data.responses.filter(r => r.surveyId === req.params.id);
    
    const statistics = {
      totalResponses: responses.length,
      questions: survey.questions.map(question => {
        const stats = {
          id: question.id,
          title: question.title,
          type: question.type
        };
        
        if (question.type === 'singleChoice' || question.type === 'multipleChoice') {
          const options = question.options || [];
          const counts = {};
          options.forEach(opt => counts[opt] = 0);
          
          responses.forEach(response => {
            const answer = response.answers[question.id];
            if (Array.isArray(answer)) {
              answer.forEach(a => counts[a] = (counts[a] || 0) + 1);
            } else if (answer) {
              counts[answer] = (counts[answer] || 0) + 1;
            }
          });
          
          stats.optionCounts = counts;
          stats.percentage = {};
          options.forEach(opt => {
            stats.percentage[opt] = responses.length > 0 
              ? ((counts[opt] / responses.length) * 100).toFixed(2)
              : 0;
          });
        } else if (question.type === 'text' || question.type === 'textarea') {
          stats.answers = responses
            .map(r => r.answers[question.id])
            .filter(a => a && a.trim());
        }
        
        return stats;
      })
    };
    
    res.json(statistics);
  } catch (error) {
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

// 4. 二维码生成
app.get('/api/surveys/:id/qrcode', async (req, res) => {
  try {
    await db.read();
    const survey = db.data.surveys.find(s => s.id === req.params.id);
    
    if (!survey) {
      return res.status(404).json({ error: '问卷不存在' });
    }
    
    const { protocol, host } = req.headers;
    // 根据问卷模式选择正确的 URL
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

// 5. 短链接生成
app.post('/api/shortlink', async (req, res) => {
  try {
    const { url } = req.body;
    const code = nanoid(6);
    await db.read();
    
    db.data.shortLinks = db.data.shortLinks || [];
    db.data.shortLinks.push({ code, originalUrl: url, createdAt: new Date().toISOString() });
    await db.write();
    
    const shortUrl = `${req.protocol}://${req.headers.host}/s/${code}`;
    res.json({ shortUrl, code });
  } catch (error) {
    res.status(500).json({ error: '生成短链接失败' });
  }
});

app.get('/s/:code', async (req, res) => {
  try {
    await db.read();
    const link = db.data.shortLinks.find(l => l.code === req.params.code);
    if (link) {
      res.redirect(link.originalUrl);
    } else {
      res.status(404).json({ error: '短链接不存在' });
    }
  } catch (error) {
    res.status(500).json({ error: '跳转失败' });
  }
});

// 6. 文件上传
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }
    res.json({
      name: req.file.originalname,
      path: `/uploads/${req.file.filename}`,
      size: req.file.size,
      type: req.file.mimetype
    });
  } catch (error) {
    res.status(500).json({ error: '文件上传失败' });
  }
});

// 6.1 PDF 解析
app.post('/api/parse-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传PDF文件' });
    }

    if (!req.file.originalname.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ error: '请上传PDF文件' });
    }

    const dataBuffer = fs.readFileSync(req.file.path);
    // pdf-parse v2.x requires Uint8Array instead of Buffer
    const uint8Array = new Uint8Array(dataBuffer);
    const parser = new PDFParse(uint8Array);
    await parser.load();
    const pdfResult = await parser.getText();
    const text = pdfResult.text; // pdf-parse v2 返回 { pages, text, total }

    // 解析问题
    const questions = parseQuestionsFromText(text);

    // 清理上传的临时文件
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      questionCount: questions.length,
      questions: questions,
      rawText: text.substring(0, 1000) // 返回部分文本用于调试
    });
  } catch (error) {
    console.error('PDF解析失败:', error);
    res.status(500).json({ error: 'PDF解析失败: ' + error.message });
  }
});

// 解析 PDF 文本为问题列表
function parseQuestionsFromText(text) {
  const questions = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  let currentQuestion = null;
  let pendingTitle = null;  // 临时存储标题，等编号

  // 编号模式 - 编号出现在行的末尾或独立成行
  const numberAtEndPattern = /(.+?)\s+(\d+)[\.\t]\s*$/;  // 标题 1. 或 标题 1.
  const numberOnlyPattern = /^(\d+)[\.\t]\s*$/;  // 纯编号 "1."

  // 章节标题关键词
  const sectionKeywords = ['准备篇', '基本信息', '仪式感', '羞耻调教', '进阶篇', 
    '匿名', '完成时间', '感谢', '谢谢', '提交'];

  // 跳过行
  const skipPatterns = [
    /^第\s*\d+\s*页$/, /^页码$/, /^共\d+页$/,
    /^[\s]*$/, /^[-=*_]{5,}$/,
    /^--\s*\d+\s*of\s*\d+\s*--$/,
  ];

  // 判断是否为必填题
  const isRequired = (line) => line.includes('*');

  // 判断是否为选项
  const isOption = (line) => {
    // 跳过编号行
    if (/^\d+[\.\t]/.test(line)) return false;
    // 跳过包含下一题编号的行
    if (/\s+\d+[\.\t]/.test(line)) return false;
    // 跳过有*的行（可能是问题的一部分）
    if (line.includes('*')) return false;
    // 选项通常是较短的文本
    if (line.length > 3 && line.length < 50) return true;
    return false;
  };

  // 判断是否为章节标题
  const isSectionTitle = (line) => {
    return sectionKeywords.some(k => line.includes(k));
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 跳过特定模式
    if (skipPatterns.some(p => p.test(line))) continue;
    if (line.length < 2) continue;
    
    // 跳过章节标题
    if (isSectionTitle(line)) continue;

    let match;
    let title = '';
    let number = 0;

    // 尝试匹配 "标题 1." 格式（编号在末尾）
    match = line.match(numberAtEndPattern);
    if (match) {
      title = match[1].trim().replace(/\s*\*+\s*/g, '');
      number = parseInt(match[2]);
    }
    // 尝试匹配纯编号 "1." 格式
    else if (numberOnlyPattern.test(line)) {
      // 纯编号行，标题应该是上一行
      if (pendingTitle) {
        title = pendingTitle;
        number = parseInt(line.match(numberOnlyPattern)[1]);
        pendingTitle = null;
      }
    }
    // 普通行，可能是标题或选项
    else {
      // 如果当前没有问题，这可能是问题标题
      if (!currentQuestion || currentQuestion.title) {
        // 如果当前问题已经有标题，说明是选项
        if (currentQuestion && currentQuestion.title && isOption(line)) {
          if (!currentQuestion.options) currentQuestion.options = [];
          currentQuestion.options.push(line);
          continue;
        }
        // 否则这可能是新问题的标题
        pendingTitle = line.replace(/\s*\*+\s*/g, '');
        continue;
      }
    }

    // 如果找到了标题，保存问题
    if (title && title.length > 0) {
      // 保存之前的问题
      if (currentQuestion && currentQuestion.title) {
        if (currentQuestion.options && currentQuestion.options.length >= 2) {
          currentQuestion.type = 'singleChoice';
        } else {
          currentQuestion.type = 'text';
          currentQuestion.options = undefined;
        }
        questions.push(currentQuestion);
      }

      // 检测是否必填（检查原行是否包含*）
      const required = line.includes('*');

      currentQuestion = {
        id: `q_${Date.now()}_${questions.length}`,
        title: title,
        type: 'text',
        required: required,
        options: []
      };
      continue;
    }

    // 如果没有找到标题但有当前问题，尝试收集选项
    if (currentQuestion && currentQuestion.title) {
      if (isOption(line)) {
        if (!currentQuestion.options) currentQuestion.options = [];
        currentQuestion.options.push(line);
      }
    }
  }

  // 保存最后一个问题
  if (currentQuestion && currentQuestion.title) {
    if (currentQuestion.options && currentQuestion.options.length >= 2) {
      currentQuestion.type = 'singleChoice';
    } else {
      currentQuestion.type = 'text';
      currentQuestion.options = undefined;
    }
    questions.push(currentQuestion);
  }

  // 过滤掉无效的问题
  return questions.filter(q => q.title && q.title.length > 0);
}

// 7. 邮件配置
app.post('/api/settings/email', async (req, res) => {
  try {
    await db.read();
    
    // 确保settings对象存在
    if (!db.data.settings) {
      db.data.settings = {};
    }
    
    db.data.settings.emailConfig = req.body;
    await db.write();
    
    console.log('邮件配置已保存:', req.body);
    res.json({ message: '邮件配置已更新' });
  } catch (error) {
    console.error('保存邮件配置失败:', error);
    res.status(500).json({ error: '更新邮件配置失败: ' + error.message });
  }
});

app.get('/api/settings/email', async (req, res) => {
  try {
    await db.read();
    res.json(db.data.settings.emailConfig);
  } catch (error) {
    res.status(500).json({ error: '获取邮件配置失败' });
  }
});

// 测试邮件发送
app.post('/api/settings/email/test', async (req, res) => {
  try {
    await db.read();
    const config = db.data.settings.emailConfig;
    
    if (!config || !config.host) {
      return res.status(400).json({ error: '请先配置邮件服务器' });
    }
    
    console.log('邮件配置:', JSON.stringify(config));
    
    if (!config.fromEmail || !config.to) {
      return res.status(400).json({ error: '请配置发件人邮箱和收件人邮箱' });
    }
    
    const fromAddress = config.fromName 
      ? `${config.fromName} <${config.fromEmail}>` 
      : config.fromEmail;
    
    const transporter = createTransporter({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass
      }
    });
    
    // 发送测试邮件
    await transporter.sendMail({
      from: fromAddress,
      to: config.to,
      subject: '测试邮件 - 问卷系统',
      html: '<h2>这是一封测试邮件</h2><p>问卷系统邮件配置成功！</p>'
    });
    
    res.json({ message: '测试邮件发送成功' });
  } catch (error) {
    console.error('测试邮件发送失败:', error);
    const errorMsg = error.message || '未知错误';
    res.status(500).json({ error: `发送失败: ${errorMsg}` });
  }
});

// 发送 PDF 邮件
async function sendPDF(response) {
  try {
    await db.read();
    const config = db.data.settings.emailConfig;
    if (!config || !config.host) {
      return;
    }
    
    const survey = db.data.surveys.find(s => s.id === response.surveyId);
    if (!survey) return;
    
    const transporter = createTransporter({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass
      }
    });
    
    const recipientEmail = response.answers.email || config.to;
    if (!recipientEmail) return;
    
    // 构建发件人地址
    const fromAddress = config.fromName 
      ? `${config.fromName} <${config.fromEmail}>` 
      : config.fromEmail;
    
    // 生成 HTML 内容
    let htmlContent = `<h2>${survey.title}</h2>`;
    htmlContent += `<p><strong>提交时间：</strong>${new Date(response.submittedAt).toLocaleString('zh-CN')}</p>`;
    htmlContent += '<hr>';
    
    survey.questions.forEach(question => {
      const answer = response.answers[question.id];
      htmlContent += `<h3>${question.title}</h3>`;
      htmlContent += `<p><strong>类型：</strong>${getQuestionTypeName(question.type)}</p>`;
      
      if (Array.isArray(answer)) {
        htmlContent += `<p><strong>回答：</strong>${answer.join(', ')}</p>`;
      } else if (answer) {
        htmlContent += `<p><strong>回答：</strong>${answer}</p>`;
      }
      htmlContent += '<br>';
    });
    
    // 添加文件列表
    if (response.files && response.files.length > 0) {
      htmlContent += '<h3>上传的文件：</h3>';
      htmlContent += '<ul>';
      response.files.forEach(file => {
        htmlContent += `<li>${file.name} (${(file.size / 1024).toFixed(2)} KB)</li>`;
      });
      htmlContent += '</ul>';
    }
    
    await transporter.sendMail({
      from: fromAddress,
      to: recipientEmail,
      subject: `问卷提交通知 - ${survey.title}`,
      html: htmlContent
    });
    
    console.log('邮件发送成功:', recipientEmail);
  } catch (error) {
    console.error('发送邮件失败:', error);
  }
}

function getQuestionTypeName(type) {
  const types = {
    singleChoice: '单选题',
    multipleChoice: '多选题',
    text: '填空题',
    textarea: '问答题',
    fileUpload: '文件上传'
  };
  return types[type] || type;
}

// ========== 数据导出 API ==========

// 导出 Excel
app.get('/api/surveys/:id/export/excel', authenticateToken, async (req, res) => {
  try {
    await db.read();
    const survey = db.data.surveys.find(s => s.id === req.params.id);
    const responses = db.data.responses.filter(r => r.surveyId === req.params.id);
    
    if (!survey) {
      return res.status(404).json({ error: '问卷不存在' });
    }
    
    // 检查权限
    if (survey.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权限导出此问卷数据' });
    }
    
    // 准备数据
    const headers = ['提交时间'];
    survey.questions.forEach(q => headers.push(q.title));
    if (responses.length > 0 && responses[0].files) {
      headers.push('附件');
    }
    
    const rows = responses.map(r => {
      const row = [new Date(r.submittedAt).toLocaleString('zh-CN')];
      survey.questions.forEach(q => {
        const answer = r.answers[q.id];
        if (Array.isArray(answer)) {
          row.push(answer.join(', '));
        } else {
          row.push(answer || '');
        }
      });
      if (r.files && r.files.length > 0) {
        row.push(r.files.map(f => f.name).join(', '));
      }
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

// 导出 CSV
app.get('/api/surveys/:id/export/csv', authenticateToken, async (req, res) => {
  try {
    await db.read();
    const survey = db.data.surveys.find(s => s.id === req.params.id);
    const responses = db.data.responses.filter(r => r.surveyId === req.params.id);
    
    if (!survey) {
      return res.status(404).json({ error: '问卷不存在' });
    }
    
    // 检查权限
    if (survey.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权限导出此问卷数据' });
    }
    
    // 准备数据
    const headers = ['提交时间'];
    survey.questions.forEach(q => headers.push(q.title));
    if (responses.length > 0 && responses[0].files) {
      headers.push('附件');
    }
    
    // CSV 转义函数
    const escapeCSV = (str) => {
      if (str === null || str === undefined) return '';
      const s = String(str);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    
    let csv = headers.map(h => escapeCSV(h)).join(',') + '\n';
    responses.forEach(r => {
      const row = [new Date(r.submittedAt).toLocaleString('zh-CN')];
      survey.questions.forEach(q => {
        const answer = r.answers[q.id];
        if (Array.isArray(answer)) {
          row.push(answer.join(', '));
        } else {
          row.push(answer || '');
        }
      });
      if (r.files && r.files.length > 0) {
        row.push(r.files.map(f => f.name).join(', '));
      }
      csv += row.map(v => escapeCSV(v)).join(',') + '\n';
    });
    
    res.setHeader('Content-Type', 'text/csv;charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(survey.title)}_答卷数据.csv`);
    res.send('\ufeff' + csv); // BOM for Excel
  } catch (error) {
    console.error('导出CSV失败:', error);
    res.status(500).json({ error: '导出失败' });
  }
});

// 导出 PDF
app.get('/api/survey/:id/export/pdf', authenticateToken, async (req, res) => {
  try {
    await db.read();
    const survey = db.data.surveys.find(s => s.id === req.params.id);
    const responses = db.data.responses.filter(r => r.surveyId === req.params.id);
    
    if (!survey) {
      return res.status(404).json({ error: '问卷不存在' });
    }
    
    // 检查权限
    if (survey.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权限导出此问卷数据' });
    }
    
    // 简单的文本报告生成
    let content = `问卷: ${survey.title}\n`;
    content += `导出时间: ${new Date().toLocaleString('zh-CN')}\n`;
    content += `答卷数量: ${responses.length}\n\n`;
    
    responses.forEach((r, i) => {
      content += `--- 第 ${i + 1} 份答卷 ---\n`;
      content += `提交时间: ${new Date(r.submittedAt).toLocaleString('zh-CN')}\n`;
      survey.questions.forEach(q => {
        const answer = r.answers[q.id];
        if (Array.isArray(answer)) {
          content += `${q.title}: ${answer.join(', ')}\n`;
        } else {
          content += `${q.title}: ${answer || '(未回答)'}\n`;
        }
      });
      content += '\n';
    });
    
    // 使用 jspdf 生成 PDF
    const { jsPDF } = pdfModule;
    const doc = new jsPDF();
    
    // 换行处理
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

app.listen(PORT, () => {
  console.log(`问卷系统后端服务运行在 http://localhost:${PORT}`);
});

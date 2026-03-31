import React, { useState, useCallback } from 'react';
import {
  Modal,
  Steps,
  Button,
  Input,
  Select,
  Space,
  Typography,
  Alert,
  Card,
  Upload,
  Tag,
  Table,
  Divider,
} from 'antd';
import {
  LinkOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  ExportOutlined,
  ArrowRightOutlined,
  InfoCircleOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';

const { Text, Paragraph } = Typography;

// ─── 类型定义 ─────────────────────────────────────────────────
interface Question {
  id: string;
  type: string;
  title: string;
  description?: string;
  required: boolean;
  options?: string[];
}

interface FormsImportProps {
  visible: boolean;
  onClose: () => void;
  onImport: (questions: Question[]) => void;
}

// ─── 常量 ─────────────────────────────────────────────────────
const STEP_PASTE_LINK = 0;
const STEP_EXPORT_GUIDE = 1;
const STEP_UPLOAD_EXCEL = 2;
const STEP_PREVIEW = 3;

// ─── 链接解析 ─────────────────────────────────────────────────
interface ParsedFormInfo {
  formId: string | null;
  shortCode: string | null;
  originalUrl: string;
  formsUrl: string;          // 直接打开表单的链接（用于引导用户）
  isValid: boolean;
  linkType: 'collaborate' | 'template' | 'fill' | 'short' | 'unknown';
}

function parseFormsUrl(raw: string): ParsedFormInfo {
  const url = raw.trim();
  const result: ParsedFormInfo = {
    formId: null,
    shortCode: null,
    originalUrl: url,
    formsUrl: url,
    isValid: false,
    linkType: 'unknown',
  };

  if (!url) return result;

  try {
    // 短链 forms.office.com/r/XXXXX 或 forms.microsoft.com/r/XXXXX
    const shortMatch = url.match(/forms(?:\.office|\.microsoft)\.com\/r\/([A-Za-z0-9_-]+)/i);
    if (shortMatch) {
      result.shortCode = shortMatch[1];
      result.isValid = true;
      result.linkType = 'short';
      result.formsUrl = url; // 短链直接用
      return result;
    }

    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const host = urlObj.hostname.toLowerCase();

    if (!host.includes('forms.office.com') && !host.includes('forms.microsoft.com')) {
      return result;
    }

    const params = urlObj.searchParams;

    // 协作链接 DesignPageV2 / DesignPage
    // https://forms.office.com/Pages/DesignPageV2.aspx?subpage=design&FormId=XXX&Token=YYY
    const formId = params.get('FormId') || params.get('formid') || params.get('id');
    if (formId) {
      result.formId = formId;
      result.isValid = true;

      const path = urlObj.pathname.toLowerCase();
      if (path.includes('designpage')) {
        result.linkType = 'collaborate';
        // 协作链接：直接跳转到该编辑页
        result.formsUrl = url;
      } else if (path.includes('shareformpage') || path.includes('sharetemplate')) {
        result.linkType = 'template';
        result.formsUrl = url;
      } else if (path.includes('responsepage') || path.includes('formresponse')) {
        result.linkType = 'fill';
        // 填写链接转协作/查看链接
        result.formsUrl = `https://forms.office.com/Pages/DesignPageV2.aspx?FormId=${formId}`;
      } else {
        result.linkType = 'collaborate';
        result.formsUrl = url;
      }
      return result;
    }

    // 如果 pathname 里有 formid
    const pathMatch = urlObj.pathname.match(/\/([A-Za-z0-9_=-]{20,})/);
    if (pathMatch) {
      result.formId = pathMatch[1];
      result.isValid = true;
      result.linkType = 'short';
      result.formsUrl = url;
      return result;
    }
  } catch {
    // URL 解析失败，可能是不完整的链接
    result.isValid = false;
  }

  return result;
}

// ─── Excel 解析（与 ExcelImport.tsx 保持一致） ───────────────
const TYPE_MAP: Record<string, string> = {
  '单选': 'single_choice', '单选题': 'single_choice', 'single': 'single_choice',
  'single_choice': 'single_choice', 'radio': 'single_choice', 'choice': 'single_choice', '选择': 'single_choice',
  '多选': 'multiple_choice', '多选题': 'multiple_choice', 'multiple': 'multiple_choice',
  'multiple_choice': 'multiple_choice', 'checkbox': 'multiple_choice',
  '文本': 'text', '文本题': 'text', '简答': 'text', '简答题': 'text', 'text': 'text', 'short answer': 'text',
  '段落': 'textarea', '段落题': 'textarea', '多行文本': 'textarea', 'textarea': 'textarea', 'paragraph': 'textarea', 'long answer': 'textarea',
  '评分': 'rating', '评分题': 'rating', 'rating': 'rating',
  '日期': 'date', '日期题': 'date', 'date': 'date',
};

const TYPE_LABELS: Record<string, string> = {
  single_choice: '单选题', multiple_choice: '多选题', text: '简答题',
  textarea: '段落题', rating: '评分题', date: '日期题',
};

const TYPE_COLORS: Record<string, string> = {
  single_choice: 'blue', multiple_choice: 'green', text: 'orange',
  textarea: 'purple', rating: 'gold', date: 'cyan',
};

function parseExcelToQuestions(workbook: XLSX.WorkBook): { questions: Question[]; warnings: string[] } {
  const questions: Question[] = [];
  const warnings: string[] = [];
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

  if (!rawData || rawData.length < 2) {
    warnings.push('Excel 文件内容为空或只有标题行');
    return { questions, warnings };
  }

  const headers = (rawData[0] as string[]).map(h => String(h).trim().toLowerCase());
  const titleColIdx = headers.findIndex(h => ['题目', 'question', '问题', '标题', 'title'].includes(h));

  if (titleColIdx !== -1) {
    const typeColIdx = headers.findIndex(h => ['类型', 'type', '题型', '问题类型'].includes(h));
    const descColIdx = headers.findIndex(h => ['描述', 'description', '说明', '备注', 'desc'].includes(h));
    const requiredColIdx = headers.findIndex(h => ['必填', 'required', '是否必填', '必须'].includes(h));
    const optionColIndices: number[] = [];
    headers.forEach((h, idx) => {
      if (h.startsWith('选项') || h.startsWith('option') || h.match(/^[a-e]$/) || h.match(/^选[abcde1-9]$/)) {
        optionColIndices.push(idx);
      }
    });
    if (optionColIndices.length === 0) {
      headers.forEach((h, idx) => {
        if (h.match(/选项\d+/) || h.match(/option\d+/)) optionColIndices.push(idx);
      });
    }

    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i] as string[];
      const title = String(row[titleColIdx] || '').trim();
      if (!title) continue;
      const typeRaw = typeColIdx >= 0 ? String(row[typeColIdx] || '').trim().toLowerCase() : '';
      const type = TYPE_MAP[typeRaw] || 'text';
      const description = descColIdx >= 0 ? String(row[descColIdx] || '').trim() : undefined;
      const requiredRaw = requiredColIdx >= 0 ? String(row[requiredColIdx] || '').trim().toLowerCase() : '';
      const required = ['yes', 'true', '是', '1', '必填', 'y'].includes(requiredRaw);
      const options = optionColIndices.map(idx => String(row[idx] || '').trim()).filter(o => o.length > 0);
      questions.push({
        id: `q_${Date.now()}_${i}`,
        type, title,
        description: description || undefined,
        required,
        options: options.length > 0 ? options : undefined,
      });
    }
    return { questions, warnings };
  }

  // Microsoft Forms 回答数据格式
  const skipCols = ['id', 'start time', 'completion time', 'email', 'name', '开始时间', '完成时间', '电子邮件', '姓名', '电子邮件地址'];
  const originalHeaders = rawData[0] as string[];
  const questionCols = originalHeaders
    .map((h, idx) => ({ header: String(h || ''), idx }))
    .filter(({ header }) => {
      const lower = header.toLowerCase().trim();
      return !skipCols.some(s => lower.includes(s)) && lower.length > 2;
    });

  if (questionCols.length > 0) {
    warnings.push('检测到 Microsoft Forms 回答数据格式，已将问题列名提取为简答题。若需精准题型，建议使用推荐模板。');
    questionCols.forEach(({ header, idx }) => {
      const col = String(header).trim();
      if (!col || col.length <= 1) return;
      questions.push({
        id: `q_${Date.now()}_${idx}`,
        type: 'text',
        title: col,
        required: false,
      });
    });
  } else {
    warnings.push('无法识别 Excel 文件格式，请检查文件内容。');
  }

  return { questions, warnings };
}

// ─── 主组件 ───────────────────────────────────────────────────
const FormsImport: React.FC<FormsImportProps> = ({ visible, onClose, onImport }) => {
  const [currentStep, setCurrentStep] = useState(STEP_PASTE_LINK);
  const [linkInput, setLinkInput] = useState('');
  const [formInfo, setFormInfo] = useState<ParsedFormInfo | null>(null);
  const [linkError, setLinkError] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // Step 0: 验证并解析链接
  const handleParseLink = useCallback(() => {
    if (!linkInput.trim()) {
      setLinkError('请先粘贴 Microsoft Forms 协作链接');
      return;
    }
    const info = parseFormsUrl(linkInput);
    if (!info.isValid) {
      setLinkError('无法识别该链接，请确认是 Microsoft Forms 的协作链接或模板链接');
      return;
    }
    setLinkError('');
    setFormInfo(info);
    setCurrentStep(STEP_EXPORT_GUIDE);
  }, [linkInput]);

  // Step 2: 上传 Excel 文件
  const handleFileUpload = useCallback((file: File) => {
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const { questions, warnings: w } = parseExcelToQuestions(workbook);
        if (questions.length === 0) {
          setWarnings(['未能解析出任何问题，请确认导出的是正确的 Excel 文件']);
          setParsedQuestions([]);
        } else {
          setParsedQuestions(questions);
          setWarnings(w);
          setCurrentStep(STEP_PREVIEW);
        }
      } catch {
        setWarnings(['Excel 文件解析失败，请重新导出后再试']);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  }, []);

  // 最终导入
  const handleConfirmImport = () => {
    onImport(parsedQuestions);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setCurrentStep(STEP_PASTE_LINK);
    setLinkInput('');
    setFormInfo(null);
    setLinkError('');
    setParsedQuestions([]);
    setWarnings([]);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // ── 步骤标题 ────────────────────────────────────────────────
  const stepItems = [
    { title: '粘贴链接' },
    { title: '导出 Excel' },
    { title: '上传文件' },
    { title: '确认导入' },
  ];

  // ── 题型选项 ────────────────────────────────────────────────
  const questionTypes = [
    { value: 'single_choice', label: '单选题', color: 'blue' },
    { value: 'multiple_choice', label: '多选题', color: 'green' },
    { value: 'text', label: '简答题', color: 'orange' },
    { value: 'textarea', label: '段落题', color: 'purple' },
    { value: 'rating', label: '评分题', color: 'gold' },
    { value: 'date', label: '日期题', color: 'cyan' },
  ];

  // 更新某个问题的题型
  const handleTypeChange = (index: number, newType: string) => {
    const updated = [...parsedQuestions];
    updated[index] = { ...updated[index], type: newType };
    setParsedQuestions(updated);
  };

  // 更新某个问题的选项
  const handleOptionsChange = (index: number, optionsStr: string) => {
    const updated = [...parsedQuestions];
    const options = optionsStr.split('\n').map(o => o.trim()).filter(o => o);
    updated[index] = { ...updated[index], options: options.length > 0 ? options : undefined };
    setParsedQuestions(updated);
  };

  // 切换必填状态
  const handleRequiredToggle = (index: number) => {
    const updated = [...parsedQuestions];
    updated[index] = { ...updated[index], required: !updated[index].required };
    setParsedQuestions(updated);
  };

  // ── 题型标签 ────────────────────────────────────────────────
  const previewColumns = [
    { title: '#', width: 45, render: (_: unknown, __: unknown, i: number) => i + 1 },
    { title: '题目', dataIndex: 'title', ellipsis: true, width: 180 },
    {
      title: '类型', dataIndex: 'type', width: 110,
      render: (t: string, __: unknown, idx: number) => (
        <Select
          size="small"
          value={t}
          onChange={(val) => handleTypeChange(idx, val)}
          style={{ width: 90 }}
        >
          {questionTypes.map(qt => (
            <Select.Option key={qt.value} value={qt.value}>
              <Tag color={qt.color} style={{ margin: 0 }}>{qt.label}</Tag>
            </Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: '选项（每行一个）', dataIndex: 'options', width: 180,
      render: (opts: string[] | undefined, __: unknown, idx: number) => {
        const q = parsedQuestions[idx];
        const showInput = q.type === 'single_choice' || q.type === 'multiple_choice';
        if (!showInput) return <Text type="secondary">—</Text>;
        return (
          <Input.TextArea
            size="small"
            rows={2}
            placeholder="每行一个选项"
            value={opts?.join('\n') || ''}
            onChange={(e) => handleOptionsChange(idx, e.target.value)}
            style={{ fontSize: 12 }}
          />
        );
      },
    },
    {
      title: '必填', dataIndex: 'required', width: 60,
      render: (r: boolean, __: unknown, idx: number) => (
        <Button
          type={r ? 'primary' : 'default'}
          size="small"
          onClick={() => handleRequiredToggle(idx)}
          style={{ minWidth: 50 }}
        >
          {r ? '是' : '否'}
        </Button>
      ),
    },
  ];

  // ── 渲染各步骤内容 ──────────────────────────────────────────
  const renderStepContent = () => {
    switch (currentStep) {

      // ── Step 0: 粘贴链接 ──
      case STEP_PASTE_LINK:
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Alert
              type="info"
              showIcon
              icon={<InfoCircleOutlined />}
              message="如何获取协作链接？"
              description={
                <ol style={{ paddingLeft: 18, margin: 0 }}>
                  <li>打开 <a href="https://forms.office.com" target="_blank" rel="noreferrer">Microsoft Forms</a>，进入你的表单</li>
                  <li>点击右上角 <Text code>协作</Text> 或 <Text code>共享</Text> 按钮</li>
                  <li>选择「协作」，复制生成的链接粘贴到下方</li>
                  <li>也可以使用「共享为模板」链接</li>
                </ol>
              }
            />

            <div>
              <Text strong>粘贴 Microsoft Forms 链接：</Text>
              <Input
                style={{ marginTop: 8 }}
                size="large"
                prefix={<LinkOutlined />}
                placeholder="https://forms.office.com/Pages/DesignPageV2.aspx?..."
                value={linkInput}
                onChange={e => {
                  setLinkInput(e.target.value);
                  setLinkError('');
                }}
                onPressEnter={handleParseLink}
                allowClear
              />
              {linkError && (
                <Text type="danger" style={{ marginTop: 4, display: 'block' }}>
                  {linkError}
                </Text>
              )}
            </div>

            <Alert
              type="warning"
              showIcon
              message="支持的链接类型"
              description={
                <ul style={{ paddingLeft: 18, margin: 0 }}>
                  <li><Text code>协作链接</Text>：可以查看/编辑表单结构</li>
                  <li><Text code>模板链接</Text>：共享为模板的链接</li>
                  <li><Text code>短链接</Text>：forms.office.com/r/xxxxx</li>
                </ul>
              }
            />
          </Space>
        );

      // ── Step 1: 引导导出 Excel ──
      case STEP_EXPORT_GUIDE:
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {formInfo && (
              <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                <Space>
                  <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 18 }} />
                  <div>
                    <Text strong>链接解析成功</Text>
                    {formInfo.linkType === 'collaborate' && <Tag color="blue" style={{ marginLeft: 8 }}>协作链接</Tag>}
                    {formInfo.linkType === 'template' && <Tag color="purple" style={{ marginLeft: 8 }}>模板链接</Tag>}
                    {formInfo.linkType === 'short' && <Tag color="cyan" style={{ marginLeft: 8 }}>短链接</Tag>}
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formInfo.formId ? `表单 ID：${formInfo.formId.substring(0, 20)}...` : '短链接格式'}
                    </Text>
                  </div>
                </Space>
              </Card>
            )}

            <Alert
              type="info"
              showIcon
              message={
                <Space>
                  <Text strong>请按照以下步骤在 Microsoft Forms 中导出 Excel</Text>
                </Space>
              }
            />

            {/* 步骤引导卡片 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                {
                  step: 1,
                  title: '打开表单',
                  desc: '点击下方按钮，在新标签页中打开你的 Microsoft Forms 表单',
                  action: (
                    <Button
                      type="primary"
                      icon={<ExportOutlined />}
                      href={formInfo?.formsUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      打开表单
                    </Button>
                  ),
                },
                {
                  step: 2,
                  title: '进入"回复"页面',
                  desc: '在表单编辑页，点击顶部「回复」选项卡',
                },
                {
                  step: 3,
                  title: '导出到 Excel',
                  desc: (
                    <>
                      点击 <Text code>在 Excel 中打开</Text> 按钮
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        ⚠️ 如果看不到这个按钮，说明还没有回答数据，请看下方「空表单处理」
                      </Text>
                    </>
                  ),
                },
                {
                  step: 4,
                  title: '上传到本系统',
                  desc: '下载好 Excel 后，点击下方"已下载，下一步"按钮上传文件',
                },
              ].map(({ step, title, desc, action }) => (
                <Card key={step} size="small" style={{ borderLeft: '3px solid #1677ff' }}>
                  <Space align="start">
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: '#1677ff', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 'bold', flexShrink: 0, fontSize: 13,
                    }}>
                      {step}
                    </div>
                    <div style={{ flex: 1 }}>
                      <Text strong>{title}</Text>
                      <div style={{ marginTop: 4, color: '#555' }}>
                        {typeof desc === 'string' ? <Text>{desc}</Text> : desc}
                      </div>
                      {action && <div style={{ marginTop: 8 }}>{action}</div>}
                    </div>
                  </Space>
                </Card>
              ))}
            </div>

            {/* 空表单处理提示 */}
            <Card size="small" style={{ background: '#fffbe6', border: '1px solid #ffe58f', marginTop: 12 }}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Text strong style={{ color: '#d48806' }}>
                  🔸 如果看不到「在 Excel 中打开」按钮（空表单）
                </Text>
                <Text style={{ fontSize: 13 }}>
                  Microsoft Forms 只在有回答数据时才显示导出按钮。请按以下步骤操作：
                </Text>
                <ol style={{ paddingLeft: 20, margin: 0, fontSize: 13, color: '#555' }}>
                  <li>在表单页面点击「预览」或直接发送给自己填写</li>
                  <li>随便填写一些测试答案（比如全部选第一个选项）</li>
                  <li>提交这个测试回答</li>
                  <li>回到「回复」页面，现在应该能看到「在 Excel 中打开」按钮了</li>
                  <li>导出 Excel 后，如果想删除测试回答：回复 → 选择该回答 → 删除</li>
                </ol>
              </Space>
            </Card>

            <Divider style={{ margin: '8px 0' }} />
            <Alert
              type="success"
              showIcon
              icon={<FileExcelOutlined />}
              message="完成以上步骤后，点击下方按钮上传 Excel 文件"
            />
          </Space>
        );

      // ── Step 2: 上传 Excel ──
      case STEP_UPLOAD_EXCEL:
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Alert
              type="info"
              showIcon
              message="上传从 Microsoft Forms 导出的 Excel 文件"
              description="请上传从 Forms「回复 → 在 Excel 中打开」下载的文件，系统将自动提取所有问题。"
            />
            {warnings.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message="上传提示"
                description={
                  <ul style={{ paddingLeft: 16, margin: 0 }}>
                    {warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                }
              />
            )}
            <Upload.Dragger
              accept=".xlsx,.xls,.csv"
              beforeUpload={handleFileUpload}
              showUploadList={false}
              disabled={uploading}
            >
              <div style={{ padding: '20px 0' }}>
                <p className="ant-upload-drag-icon">
                  <FileExcelOutlined style={{ fontSize: 48, color: '#217346' }} />
                </p>
                <p className="ant-upload-text">点击或拖拽 Excel 文件到此处</p>
                <p className="ant-upload-hint">支持 .xlsx、.xls、.csv 格式</p>
              </div>
            </Upload.Dragger>
          </Space>
        );

      // ── Step 3: 预览确认 ──
      case STEP_PREVIEW:
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {warnings.length > 0 && (
              <Alert
                type="warning"
                showIcon
                message="解析提示"
                description={
                  <ul style={{ paddingLeft: 16, margin: 0 }}>
                    {warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                }
              />
            )}
            <div>
              <Text>
                共解析到{' '}
                <Text strong style={{ color: '#1677ff', fontSize: 16 }}>
                  {parsedQuestions.length}
                </Text>{' '}
                个问题，确认后将导入到当前问卷：
              </Text>
            </div>
            <Table
              size="small"
              columns={previewColumns}
              dataSource={parsedQuestions.map((q, i) => ({ ...q, key: i }))}
              pagination={{ pageSize: 8, showSizeChanger: false }}
              scroll={{ y: 300 }}
            />
          </Space>
        );

      default:
        return null;
    }
  };

  // ── Footer 按钮 ─────────────────────────────────────────────
  const renderFooter = () => {
    switch (currentStep) {
      case STEP_PASTE_LINK:
        return (
          <Space>
            <Button onClick={handleClose}>取消</Button>
            <Button type="primary" icon={<ArrowRightOutlined />} onClick={handleParseLink}>
              解析链接
            </Button>
          </Space>
        );
      case STEP_EXPORT_GUIDE:
        return (
          <Space>
            <Button onClick={() => setCurrentStep(STEP_PASTE_LINK)}>上一步</Button>
            <Button onClick={handleClose}>取消</Button>
            <Button
              type="primary"
              icon={<FileExcelOutlined />}
              onClick={() => setCurrentStep(STEP_UPLOAD_EXCEL)}
            >
              已下载 Excel，去上传
            </Button>
          </Space>
        );
      case STEP_UPLOAD_EXCEL:
        return (
          <Space>
            <Button onClick={() => setCurrentStep(STEP_EXPORT_GUIDE)}>上一步</Button>
            <Button onClick={handleClose}>取消</Button>
          </Space>
        );
      case STEP_PREVIEW:
        return (
          <Space>
            <Button onClick={() => setCurrentStep(STEP_UPLOAD_EXCEL)}>重新上传</Button>
            <Button onClick={handleClose}>取消</Button>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={handleConfirmImport}
              disabled={parsedQuestions.length === 0}
            >
              导入 {parsedQuestions.length} 个问题
            </Button>
          </Space>
        );
      default:
        return null;
    }
  };

  return (
    <Modal
      title={
        <Space>
          <LinkOutlined style={{ color: '#0078d4' }} />
          从 Microsoft Forms 导入
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      width={700}
      footer={renderFooter()}
      destroyOnClose
    >
      <Steps
        current={currentStep}
        size="small"
        items={stepItems}
        style={{ marginBottom: 24 }}
      />
      {renderStepContent()}
    </Modal>
  );
};

export default FormsImport;

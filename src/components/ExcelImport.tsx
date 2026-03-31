import React, { useState } from 'react';
import {
  Upload,
  Button,
  message,
  Modal,
  Typography,
  Space,
  Tag,
  Alert,
  Table,
  Steps,
  Collapse
} from 'antd';
import {
  UploadOutlined,
  FileExcelOutlined,
  CheckOutlined,
  CloseOutlined,
  DownloadOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';

const { Text, Paragraph } = Typography;

interface Question {
  id: string;
  type: string;
  title: string;
  description?: string;
  required: boolean;
  options?: string[];
}

interface ExcelImportProps {
  visible: boolean;
  onClose: () => void;
  onImport: (questions: Question[]) => void;
}

// 支持的题目类型映射
const TYPE_MAP: Record<string, string> = {
  // 单选
  '单选': 'single_choice',
  '单选题': 'single_choice',
  'single': 'single_choice',
  'single_choice': 'single_choice',
  'radio': 'single_choice',
  'choice': 'single_choice',
  '选择': 'single_choice',
  // 多选
  '多选': 'multiple_choice',
  '多选题': 'multiple_choice',
  'multiple': 'multiple_choice',
  'multiple_choice': 'multiple_choice',
  'checkbox': 'multiple_choice',
  // 文本
  '文本': 'text',
  '文本题': 'text',
  '简答': 'text',
  '简答题': 'text',
  'text': 'text',
  'short answer': 'text',
  // 多行文本
  '段落': 'textarea',
  '段落题': 'textarea',
  '多行文本': 'textarea',
  'textarea': 'textarea',
  'paragraph': 'textarea',
  'long answer': 'textarea',
  // 评分
  '评分': 'rating',
  '评分题': 'rating',
  'rating': 'rating',
  // 日期
  '日期': 'date',
  '日期题': 'date',
  'date': 'date',
};

const TYPE_LABELS: Record<string, string> = {
  single_choice: '单选题',
  multiple_choice: '多选题',
  text: '简答题',
  textarea: '段落题',
  rating: '评分题',
  date: '日期题',
};

const TYPE_COLORS: Record<string, string> = {
  single_choice: 'blue',
  multiple_choice: 'green',
  text: 'orange',
  textarea: 'purple',
  rating: 'gold',
  date: 'cyan',
};

/**
 * 解析 Excel 工作表数据为问题列表
 * 支持两种格式：
 * 1. 模板格式：标题行 + 数据行（推荐）
 * 2. Microsoft Forms 回答格式：自动识别问题列
 */
function parseExcelToQuestions(workbook: XLSX.WorkBook): { questions: Question[]; warnings: string[] } {
  const questions: Question[] = [];
  const warnings: string[] = [];

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1, defval: '' });

  if (!rawData || rawData.length < 2) {
    warnings.push('Excel 文件内容为空或只有标题行');
    return { questions, warnings };
  }

  const headers = (rawData[0] as string[]).map(h => String(h).trim().toLowerCase());

  // ===== 格式1: 模板格式检测 =====
  // 检查是否包含 "题目" 或 "question" 列
  const titleColIdx = headers.findIndex(h =>
    ['题目', 'question', '问题', '标题', 'title'].includes(h)
  );

  if (titleColIdx !== -1) {
    // 模板格式解析
    const typeColIdx = headers.findIndex(h =>
      ['类型', 'type', '题型', '问题类型'].includes(h)
    );
    const descColIdx = headers.findIndex(h =>
      ['描述', 'description', '说明', '备注', 'desc'].includes(h)
    );
    const requiredColIdx = headers.findIndex(h =>
      ['必填', 'required', '是否必填', '必须'].includes(h)
    );

    // 找到所有"选项"列
    const optionColIndices: number[] = [];
    headers.forEach((h, idx) => {
      if (
        h.startsWith('选项') ||
        h.startsWith('option') ||
        h.match(/^[a-e]$/) ||
        h.match(/^选[abcde1-9]$/)
      ) {
        optionColIndices.push(idx);
      }
    });

    // 如果没有找到选项列，尝试找 "选项1"、"选项2" 等
    if (optionColIndices.length === 0) {
      headers.forEach((h, idx) => {
        if (h.match(/选项\d+/) || h.match(/option\d+/)) {
          optionColIndices.push(idx);
        }
      });
    }

    for (let rowIdx = 1; rowIdx < rawData.length; rowIdx++) {
      const row = rawData[rowIdx] as string[];
      const title = String(row[titleColIdx] || '').trim();
      if (!title) continue;

      const typeRaw = typeColIdx >= 0 ? String(row[typeColIdx] || '').trim().toLowerCase() : '';
      const type = TYPE_MAP[typeRaw] || TYPE_MAP[typeRaw.toLowerCase()] || 'text';

      const description = descColIdx >= 0 ? String(row[descColIdx] || '').trim() : undefined;
      const requiredRaw = requiredColIdx >= 0 ? String(row[requiredColIdx] || '').trim().toLowerCase() : '';
      const required = ['yes', 'true', '是', '1', '必填', 'y'].includes(requiredRaw);

      const options = optionColIndices
        .map(idx => String(row[idx] || '').trim())
        .filter(opt => opt.length > 0);

      questions.push({
        id: `q_${Date.now()}_${rowIdx}`,
        type,
        title,
        description: description || undefined,
        required,
        options: options.length > 0 ? options : undefined,
      });
    }

    return { questions, warnings };
  }

  // ===== 格式2: Microsoft Forms 回答数据格式 =====
  // Forms 导出的回答 Excel 格式：
  // 第1行: ID | 开始时间 | 完成时间 | 电子邮件 | 姓名 | [问题1] | [问题2] ...
  // 这里我们提取问题列名作为文本题
  const skipCols = ['id', 'start time', 'completion time', 'email', 'name', '开始时间', '完成时间', '电子邮件', '姓名', '电子邮件地址'];
  const questionCols = headers
    .map((h, idx) => ({ header: String(rawData[0] as string[])[idx] || h, idx }))
    .filter(({ header }) => {
      const lower = header.toLowerCase().trim();
      return !skipCols.some(skip => lower.includes(skip)) && lower.length > 2;
    });

  // 重新从原始标题行提取（保留原始大小写）
  const originalHeaders = rawData[0] as string[];

  if (questionCols.length > 0) {
    warnings.push('检测到 Microsoft Forms 回答数据格式，已提取问题列名为简答题。建议使用问卷模板格式以获得更准确的题型识别。');
    questionCols.forEach(({ idx }) => {
      const colName = String(originalHeaders[idx] || '').trim();
      if (!colName || colName.length <= 1) return;

      // 尝试从列名推断题型
      let type = 'text';
      if (colName.includes('(') && colName.includes(')')) {
        // 可能是多选题的格式: "请选择 (可以选多个)"
        type = 'multiple_choice';
      }

      questions.push({
        id: `q_${Date.now()}_${idx}`,
        type,
        title: colName,
        required: false,
        options: undefined,
      });
    });
  } else {
    warnings.push('无法识别 Excel 文件格式。请使用推荐的模板格式。');
  }

  return { questions, warnings };
}

/**
 * 生成并下载模板 Excel 文件
 */
function downloadTemplate() {
  const wb = XLSX.utils.book_new();

  // 模板数据
  const templateData = [
    ['题目', '类型', '选项1', '选项2', '选项3', '选项4', '选项5', '描述', '必填'],
    ['您的性别是？', '单选', '男', '女', '其他', '', '', '', '是'],
    ['您的年龄段？', '单选', '18岁以下', '18-25岁', '26-35岁', '36-45岁', '45岁以上', '', '是'],
    ['您最喜欢的运动（可多选）', '多选', '跑步', '游泳', '篮球', '足球', '其他', '', '否'],
    ['请简要描述您的工作', '简答', '', '', '', '', '', '请用一句话描述', '否'],
    ['请详细介绍您的兴趣爱好', '段落', '', '', '', '', '', '', '否'],
    ['您对本次活动的满意度', '评分', '', '', '', '', '', '1-5分', '是'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(templateData);

  // 设置列宽
  ws['!cols'] = [
    { wch: 30 }, // 题目
    { wch: 12 }, // 类型
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, // 选项1-5
    { wch: 20 }, // 描述
    { wch: 10 }, // 必填
  ];

  XLSX.utils.book_append_sheet(wb, ws, '问卷模板');

  // 添加说明工作表
  const helpData = [
    ['字段说明'],
    [''],
    ['字段名', '说明', '示例值'],
    ['题目', '问题标题（必填）', '您的性别是？'],
    ['类型', '题目类型（见下表）', '单选'],
    ['选项1-5', '选择题的选项（可扩展更多列）', '男'],
    ['描述', '问题的补充说明（选填）', '请选择一个'],
    ['必填', '是否为必填项', '是 或 否'],
    [''],
    ['支持的题目类型'],
    ['类型名称', '等效写法'],
    ['单选', '单选题, single, radio, choice'],
    ['多选', '多选题, multiple, checkbox'],
    ['简答', '文本, 文本题, text, short answer'],
    ['段落', '段落题, 多行文本, textarea, paragraph'],
    ['评分', '评分题, rating'],
    ['日期', '日期题, date'],
  ];

  const wsHelp = XLSX.utils.aoa_to_sheet(helpData);
  wsHelp['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsHelp, '字段说明');

  XLSX.writeFile(wb, '问卷模板.xlsx');
}

const ExcelImport: React.FC<ExcelImportProps> = ({ visible, onClose, onImport }) => {
  const [loading, setLoading] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [step, setStep] = useState(0); // 0: 上传, 1: 预览

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      const { questions, warnings: parseWarnings } = parseExcelToQuestions(workbook);

      if (questions.length === 0) {
        message.error('未能从 Excel 文件中解析出任何问题，请检查文件格式');
        setLoading(false);
        return false;
      }

      setParsedQuestions(questions);
      setWarnings(parseWarnings);
      setStep(1);
      message.success(`成功解析 ${questions.length} 个问题`);
    } catch (err) {
      console.error('Excel 解析失败:', err);
      message.error('Excel 文件解析失败，请确认文件格式正确');
    } finally {
      setLoading(false);
    }
    return false; // 阻止默认上传行为
  };

  const handleImport = () => {
    onImport(parsedQuestions);
    handleReset();
    onClose();
  };

  const handleReset = () => {
    setParsedQuestions([]);
    setWarnings([]);
    setStep(0);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const previewColumns = [
    {
      title: '#',
      dataIndex: 'index',
      width: 50,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: '题目',
      dataIndex: 'title',
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'type',
      width: 90,
      render: (type: string) => (
        <Tag color={TYPE_COLORS[type] || 'default'}>
          {TYPE_LABELS[type] || type}
        </Tag>
      ),
    },
    {
      title: '选项',
      dataIndex: 'options',
      render: (options?: string[]) =>
        options && options.length > 0 ? (
          <Space wrap size={[4, 4]}>
            {options.slice(0, 4).map((opt, i) => (
              <Tag key={i}>{opt}</Tag>
            ))}
            {options.length > 4 && <Tag>+{options.length - 4}个</Tag>}
          </Space>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: '必填',
      dataIndex: 'required',
      width: 70,
      render: (required: boolean) =>
        required ? (
          <CheckOutlined style={{ color: '#52c41a' }} />
        ) : (
          <CloseOutlined style={{ color: '#ccc' }} />
        ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <FileExcelOutlined style={{ color: '#217346' }} />
          从 Excel 导入问卷
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      width={860}
      footer={
        step === 0 ? (
          <Button onClick={handleClose}>取消</Button>
        ) : (
          <Space>
            <Button onClick={handleReset}>重新上传</Button>
            <Button onClick={handleClose}>取消</Button>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={handleImport}
            >
              导入 {parsedQuestions.length} 个问题
            </Button>
          </Space>
        )
      }
    >
      <Steps
        current={step}
        size="small"
        style={{ marginBottom: 24 }}
        items={[
          { title: '上传文件' },
          { title: '确认导入' },
        ]}
      />

      {step === 0 && (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 说明区域 */}
          <Alert
            message="支持的 Excel 格式"
            description={
              <div>
                <Paragraph style={{ marginBottom: 8 }}>
                  <Text strong>格式一（推荐）：问卷模板格式</Text>
                  — 每行一道题，包含"题目"、"类型"、"选项"等列。
                  <Button
                    type="link"
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={downloadTemplate}
                    style={{ padding: '0 4px' }}
                  >
                    下载模板
                  </Button>
                </Paragraph>
                <Paragraph style={{ marginBottom: 0 }}>
                  <Text strong>格式二：Microsoft Forms 回答数据</Text>
                  — 直接导入从 Microsoft Forms 导出的回答 Excel，
                  系统将把每列（问题列）提取为文本题。
                </Paragraph>
              </div>
            }
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
          />

          {/* 模板格式说明 */}
          <Collapse
            ghost
            items={[{
              key: '1',
              label: '查看模板格式详情',
              children: (
                <Table
                  size="small"
                  pagination={false}
                  dataSource={[
                    { key: 1, field: '题目', desc: '问题标题（必填）', example: '您的性别是？' },
                    { key: 2, field: '类型', desc: '单选 / 多选 / 简答 / 段落 / 评分 / 日期', example: '单选' },
                    { key: 3, field: '选项1~N', desc: '选择题的选项，可增加选项2、选项3等列', example: '男' },
                    { key: 4, field: '描述', desc: '问题的补充说明（选填）', example: '请如实填写' },
                    { key: 5, field: '必填', desc: '"是" 或 "否"（选填，默认否）', example: '是' },
                  ]}
                  columns={[
                    { title: '列名', dataIndex: 'field', width: 100 },
                    { title: '说明', dataIndex: 'desc' },
                    { title: '示例', dataIndex: 'example', width: 130 },
                  ]}
                />
              )
            }]}
          />

          {/* 上传区域 */}
          <Upload.Dragger
            accept=".xlsx,.xls,.csv"
            beforeUpload={handleFileUpload}
            showUploadList={false}
            disabled={loading}
          >
            <div style={{ padding: '20px 0' }}>
              <p className="ant-upload-drag-icon">
                <FileExcelOutlined style={{ fontSize: 48, color: '#217346' }} />
              </p>
              <p className="ant-upload-text">点击或拖拽 Excel 文件到此处上传</p>
              <p className="ant-upload-hint">
                支持 .xlsx、.xls、.csv 格式
              </p>
            </div>
          </Upload.Dragger>
        </Space>
      )}

      {step === 1 && (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {warnings.length > 0 && (
            <Alert
              message="解析提示"
              description={
                <ul style={{ paddingLeft: 16, margin: 0 }}>
                  {warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              }
              type="warning"
              showIcon
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text>
              共解析到 <Text strong style={{ color: '#1677ff' }}>{parsedQuestions.length}</Text> 个问题，请确认后导入：
            </Text>
          </div>

          <Table
            size="small"
            columns={previewColumns}
            dataSource={parsedQuestions.map((q, i) => ({ ...q, key: i }))}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ y: 340 }}
          />
        </Space>
      )}
    </Modal>
  );
};

export default ExcelImport;

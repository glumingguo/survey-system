import React, { useState } from 'react';
import {
  Upload,
  Button,
  Input,
  message,
  Modal,
  Typography,
  Space,
  Card,
  List,
  Tag,
  Alert,
  Divider,
  Select
} from 'antd';
import {
  UploadOutlined,
  FileTextOutlined,
  CheckOutlined,
  CloseOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text, Paragraph } = Typography;

interface Question {
  id: string;
  type: string;
  title: string;
  description?: string;
  required: boolean;
  options?: string[];
}

interface PDFImportProps {
  visible: boolean;
  onClose: () => void;
  onImport: (questions: Question[]) => void;
}

const PDFImport: React.FC<PDFImportProps> = ({
  visible,
  onClose,
  onImport
}) => {
  const [loading, setLoading] = useState(false);
  const [parsedQuestions, setParsedQuestions] = useState<Question[]>([]);
  const [fileName, setFileName] = useState('');

  // 题型选项（用于预览时修改）
  const questionTypes = [
    { value: 'single_choice', label: '单选题', color: 'blue' },
    { value: 'multiple_choice', label: '多选题', color: 'green' },
    { value: 'text', label: '简答题', color: 'orange' },
    { value: 'textarea', label: '段落题', color: 'purple' },
    { value: 'rating', label: '评分题', color: 'gold' },
    { value: 'date', label: '日期题', color: 'cyan' },
  ];

  // 更新题型
  const handleTypeChange = (index: number, newType: string) => {
    const updated = [...parsedQuestions];
    updated[index] = { ...updated[index], type: newType };
    setParsedQuestions(updated);
  };

  // 更新选项
  const handleOptionsChange = (index: number, optionsStr: string) => {
    const updated = [...parsedQuestions];
    const options = optionsStr.split('\n').map(o => o.trim()).filter(o => o);
    updated[index] = { ...updated[index], options: options.length > 0 ? options : undefined };
    setParsedQuestions(updated);
  };

  // 切换必填
  const handleRequiredToggle = (index: number) => {
    const updated = [...parsedQuestions];
    updated[index] = { ...updated[index], required: !updated[index].required };
    setParsedQuestions(updated);
  };

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setFileName(file.name);
    setParsedQuestions([]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // 调用后端 API 解析 PDF
      const response = await axios.post('/api/parse-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        const questions = response.data.questions || [];
        if (questions.length === 0) {
          message.warning('未检测到可识别的问题格式');
        } else {
          message.success(`成功解析 ${questions.length} 个问题`);
          setParsedQuestions(questions);
        }
      } else {
        message.error(response.data.error || 'PDF 解析失败');
      }
    } catch (error: any) {
      console.error('PDF 解析失败:', error);
      let errorMessage = 'PDF 解析失败，请检查文件格式';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = `PDF 解析失败: ${error.message}`;
      }
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }

    return false; // 阻止自动上传
  };

  const parseQuestionsFromText = (text: string): Question[] => {
    const questions: Question[] = [];
    const lines = text.split('\n').filter(line => line.trim());

    let currentQuestion: Partial<Question> | null = null;
    let questionNumber = 0;
    let pendingQuestionTitle: string | null = null; // 用于存储待处理的标题

    // 常见的问题识别模式
    const questionPatterns = [
      /^(\d+)[.、．]\s*(.+)/,           // 1. 问题 或 1、问题
      /^([一二三四五六七八九十]+)[.、．]\s*(.+)/, // 一. 问题
      /^[(（]\d+[)）]\s*(.+)/,       // (1) 问题
      /^第\s*\d+\s*[题题]\s*[:：]\s*(.+)/, // 第1题：问题
      /^Question\s*\d+[:：]\s*(.+)/i, // Question 1: 问题
      /^[Qq]\s*\d+[:：]\s*(.+)/,      // Q1: 问题
      /^【\d+】\s*(.+)/,              // 【1】问题
      /^\d+\s*[.、．]\s*(.+)/,       // 1. 问题（全角点）
    ];

    const choicePatterns = [
      /^[A-Za-z][.、．]\s*(.+)/,      // A. 选项（包括全角点）
      /^[(（][A-Za-z][)）]\s*(.+)/,  // (A) 选项
      /^\([1-9]\)\s*(.+)/,           // (1) 选项
      /^[①②③④⑤⑥⑦⑧⑨⑩]\s*(.+)/,    // ① 选项
      /^[1-9][.、．]\s*(.+)/,        // 1. 选项
    ];

    // 特殊格式：问题编号在单独一行，带有 * 标记
    const specialNumberPattern = /^(\d+)\.\s*\*$/;  // 例如：3. *

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) continue;

      // 检查特殊格式：问题编号单独一行（例如：3. *）
      const specialMatch = line.match(specialNumberPattern);
      if (specialMatch) {
        // 保存之前的问题
        if (currentQuestion && currentQuestion.title) {
          questions.push(currentQuestion as Question);
        }

        questionNumber++;
        const title = pendingQuestionTitle || `问题 ${questionNumber}`;

        currentQuestion = {
          id: Date.now().toString() + questionNumber,
          type: 'singleChoice',
          title: title,
          required: false,
          options: []
        };

        pendingQuestionTitle = null;
        continue;
      }

      // 检查是否是新问题
      let isQuestion = false;
      let questionTitle = '';
      let questionType = 'text';

      for (const pattern of questionPatterns) {
        const match = line.match(pattern);
        if (match) {
          isQuestion = true;
          questionTitle = match[2] || match[1];
          questionNumber++;
          break;
        }
      }

      // 如果不是标准格式，尝试其他识别方式
      if (!isQuestion) {
        // 检查是否包含问号
        if (line.includes('?') || line.includes('？')) {
          isQuestion = true;
          questionTitle = line;
          questionNumber++;
        }
        // 检查是否包含选择题关键词
        else if (line.includes('单选题') || line.includes('选择题') ||
                 line.includes('多选题') || line.includes('不定项')) {
          isQuestion = true;
          questionTitle = line.replace(/单选题|选择题|多选题|不定项/g, '').trim();
          questionNumber++;
        }
        // 检查是否以数字开头且长度适中（可能是问题）
        else if (/^\d+\s+.{5,50}$/.test(line) && !currentQuestion) {
          isQuestion = true;
          questionTitle = line.replace(/^\d+\s+/, '');
          questionNumber++;
        }
        // 检查是否是潜在的问题标题（长度适中，不包含常见选项词）
        else if (line.length > 5 && line.length < 100 &&
                 !line.match(/^(\d+)[.、．]/) &&
                 !line.match(/^[A-Za-z][.、．]/) &&
                 !line.match(/^[(（][A-Za-z][)）]/) &&
                 !line.match(/^\([1-9]\)/) &&
                 !line.match(/^[①②③④⑤⑥⑦⑧⑨⑩]/) &&
                 !line.includes('Page') &&
                 !line.includes('===')) {
          // 如果当前没有问题，这可能是一个问题标题
          if (!currentQuestion && !pendingQuestionTitle) {
            pendingQuestionTitle = line;
            continue;
          }
        }
      }

      if (isQuestion) {
        // 如果之前有问题，先保存
        if (currentQuestion && currentQuestion.title) {
          questions.push(currentQuestion as Question);
        }

        // 确定问题类型
        let type = 'text';
        if (line.includes('多选题') || line.includes('多选') || line.includes('不定项')) {
          type = 'multipleChoice';
        } else if (line.includes('单选题') || line.includes('单选') || line.includes('选择')) {
          type = 'singleChoice';
        }

        currentQuestion = {
          id: Date.now().toString() + questionNumber,
          type,
          title: questionTitle,
          required: false,
          options: []
        };
        pendingQuestionTitle = null;
      } else if (currentQuestion) {
        // 检查是否是选项
        let isOption = false;
        let optionText = '';

        for (const pattern of choicePatterns) {
          const match = line.match(pattern);
          if (match) {
            isOption = true;
            optionText = match[1];
            break;
          }
        }

        // 检查常见的中文选项词
        if (!isOption && (line.startsWith('是') || line.startsWith('否') ||
                          line.startsWith('没有') || line.startsWith('有过') ||
                          line.startsWith('好的') || line.startsWith('我'))) {
          // 如果当前问题还没有选项类型，且这行看起来像答案，则视为选项
          if (currentQuestion.options && currentQuestion.options.length < 10) {
            isOption = true;
            optionText = line;
          }
        }

        if (isOption && (currentQuestion.type === 'singleChoice' || currentQuestion.type === 'multipleChoice')) {
          if (currentQuestion.options && !currentQuestion.options.includes(optionText)) {
            currentQuestion.options.push(optionText);
          }
        } else if (line.length > 3 && !line.match(/^\d+[.、]/) && !line.match(/^[一二三四五六七八九十]+[.、]/)) {
          // 可能是问题描述或详细说明
          // 过滤掉太短的行或看起来像页码的行
          if (line.length > 5 && !line.match(/^\d{1,3}$/) && !line.match(/第\d+页/)) {
            if (currentQuestion.description) {
              currentQuestion.description += ' ' + line;
            } else {
              currentQuestion.description = line;
            }
          }
        }
      }
    }

    // 添加最后一个问题
    if (currentQuestion && currentQuestion.title) {
      questions.push(currentQuestion as Question);
    }

    return questions;
  };

  const handleConfirmImport = () => {
    if (parsedQuestions.length === 0) {
      message.warning('没有可导入的问题');
      return;
    }

    onImport(parsedQuestions);
    handleClose();
  };

  const handleClose = () => {
    setParsedQuestions([]);
    setFileName('');
    onClose();
  };

  const getQuestionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      text: '简答题',
      textarea: '段落题',
      single_choice: '单选题',
      multiple_choice: '多选题',
      rating: '评分题',
      date: '日期题'
    };
    return labels[type] || type;
  };

  const getQuestionTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      text: 'orange',
      textarea: 'purple',
      single_choice: 'blue',
      multiple_choice: 'green',
      rating: 'gold',
      date: 'cyan'
    };
    return colors[type] || 'default';
  };

  return (
    <Modal
      title="从 PDF 导入问卷"
      open={visible}
      onCancel={handleClose}
      width={900}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          取消
        </Button>,
        <Button
          key="import"
          type="primary"
          onClick={handleConfirmImport}
          disabled={parsedQuestions.length === 0}
        >
          确认导入 ({parsedQuestions.length})
        </Button>
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Alert
          message="支持的格式"
          description={
            <div>
              <p>支持识别以下格式的问题：</p>
              <ul>
                <li>数字编号：1. 问题、1、问题、1．问题</li>
                <li>括号编号：(1) 问题、(1)问题</li>
                <li>中文编号：一. 问题、二、问题</li>
                <li>字母编号：Q1: 问题、Question 1: 问题</li>
                <li>其他格式：第1题：问题、【1】问题</li>
                <li>特殊格式：问题标题在单独一行，编号在下一行（例如：3. *）</li>
              </ul>
              <p>支持的选项格式：A. 选项、(A) 选项、① 选项、1. 选项</p>
              <p>也支持中文选项：是、否、好的、没有等</p>
            </div>
          }
          type="info"
          showIcon
        />

        <Card>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Upload
              accept=".pdf"
              showUploadList={false}
              beforeUpload={handleFileUpload}
            >
              <Button
                icon={<UploadOutlined />}
                loading={loading}
                size="large"
                style={{ width: '100%' }}
              >
                {loading ? '正在解析 PDF...' : '选择 PDF 文件'}
              </Button>
            </Upload>

            <Divider />

            <Button
              icon={<DownloadOutlined />}
              onClick={() => {
                const link = document.createElement('a');
                link.href = '/test_survey.pdf';
                link.download = 'test_survey.pdf';
                link.click();
                message.info('已下载测试PDF文件');
              }}
            >
              下载测试 PDF 文件
            </Button>
          </Space>

          {fileName && (
            <div style={{ marginTop: 16 }}>
              <Space>
                <FileTextOutlined style={{ fontSize: '20px' }} />
                <Text strong>{fileName}</Text>
                <Tag color={parsedQuestions.length > 0 ? 'success' : 'default'}>
                  {parsedQuestions.length > 0 ? (
                    <>
                      <CheckOutlined /> 成功解析
                    </>
                  ) : (
                    <>
                      <CloseOutlined /> 解析失败
                    </>
                  )}
                </Tag>
              </Space>
            </div>
          )}
        </Card>

        {parsedQuestions.length > 0 && (
          <Card>
            <Title level={4}>解析结果预览（点击题型可修改）</Title>
            <List
              dataSource={parsedQuestions}
              renderItem={(question, index) => (
                <List.Item
                  actions={[
                    <Select
                      key="type"
                      size="small"
                      value={question.type}
                      onChange={(val) => handleTypeChange(index, val)}
                      style={{ width: 100 }}
                    >
                      {questionTypes.map(qt => (
                        <Select.Option key={qt.value} value={qt.value}>
                          <Tag color={qt.color} style={{ margin: 0 }}>{qt.label}</Tag>
                        </Select.Option>
                      ))}
                    </Select>,
                    <Button
                      key="required"
                      size="small"
                      type={question.required ? 'primary' : 'default'}
                      onClick={() => handleRequiredToggle(index)}
                    >
                      {question.required ? '必填' : '选填'}
                    </Button>
                  ]}
                >
                  <Space direction="vertical" style={{ width: '100%', flex: 1 }}>
                    <Space>
                      <Tag color={getQuestionTypeColor(question.type)}>
                        {getQuestionTypeLabel(question.type)}
                      </Tag>
                      <Text strong>问题 {index + 1}</Text>
                    </Space>
                    <Text>{question.title}</Text>
                    {question.description && (
                      <Text type="secondary" italic>{question.description}</Text>
                    )}
                    {(question.type === 'single_choice' || question.type === 'multiple_choice') && (
                      <Input.TextArea
                        size="small"
                        rows={2}
                        placeholder="每行一个选项"
                        value={question.options?.join('\n') || ''}
                        onChange={(e) => handleOptionsChange(index, e.target.value)}
                        style={{ marginTop: 8 }}
                      />
                    )}
                    {question.options && question.options.length > 0 && !(question.type === 'single_choice' || question.type === 'multiple_choice') && (
                      <div style={{ marginLeft: 16 }}>
                        {question.options.map((option, optIndex) => (
                          <div key={optIndex}>
                            <Text type="secondary">
                              {String.fromCharCode(65 + optIndex)}. {option}
                            </Text>
                          </div>
                        ))}
                      </div>
                    )}
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        )}
      </Space>
    </Modal>
  );
};

export default PDFImport;

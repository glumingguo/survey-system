import React, { useState, useEffect } from 'react';
import { 
  Form, 
  Input, 
  InputNumber,
  Button, 
  Card, 
  Space, 
  message, 
  Upload, 
  Select,
  Radio,
  Switch,
  Divider,
  Modal,
  Image,
  Typography,
  Tooltip,
  Tag,
  Dropdown
} from 'antd';
import type { MenuProps } from 'antd';
import { 
  PlusOutlined, 
  MinusCircleOutlined, 
  SaveOutlined,
  DeleteOutlined,
  UploadOutlined,
  InfoCircleOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  LinkOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  FolderOutlined,
  MoreOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  NodeIndexOutlined,
  RightOutlined,
  StopOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import PDFImport from './PDFImport';
import ExcelImport from './ExcelImport';
import FormsImport from './FormsImport';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface BranchLogic {
  id: string;
  sourceQuestionId: string;
  sourceOption: string;
  action: 'skip' | 'jump';
  skipCount?: number;
  targetQuestionId?: string;
}

interface Section {
  id: string;
  title: string;
  description?: string;
}

// 选项跳转设置
interface OptionJump {
  optionText: string;
  jumpType: 'next' | 'question' | 'end';
  targetQuestionId?: string;
}

interface Question {
  id: string;
  type: string;
  title: string;
  description?: string;
  required: boolean;
  options?: string[];
  optionJumps?: OptionJump[]; // 选项跳转设置
  imageUrl?: string;
  sectionId?: string;
}

interface SurveyData {
  id?: string;
  title: string;
  description: string;
  titleImageUrl?: string;
  sections: Section[];
  branchLogics: BranchLogic[];
  status: 'draft' | 'published' | 'closed';
  questions: Question[];
  sequentialMode?: boolean;
}

const SurveyEditor: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [branchLogics, setBranchLogics] = useState<BranchLogic[]>([]);
  const [titleImageUrl, setTitleImageUrl] = useState<string>('');
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [currentImage, setCurrentImage] = useState('');
  const [pdfImportVisible, setPdfImportVisible] = useState(false);
  const [excelImportVisible, setExcelImportVisible] = useState(false);
  const [formsImportVisible, setFormsImportVisible] = useState(false);
  const [sectionModalVisible, setSectionModalVisible] = useState(false);
  const [branchModalVisible, setBranchModalVisible] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [editingBranch, setEditingBranch] = useState<BranchLogic | null>(null);
  const [jumpPreviewVisible, setJumpPreviewVisible] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    if (id) {
      fetchSurvey(id);
    }
  }, [id]);

  const fetchSurvey = async (surveyId: string) => {
    try {
      const response = await axios.get(`/api/surveys/${surveyId}`);
      const survey = response.data;
      form.setFieldsValue(survey);
      setQuestions(survey.questions || []);
      setSections(survey.sections || []);
      setBranchLogics(survey.branchLogics || []);
      setTitleImageUrl(survey.titleImageUrl || '');
    } catch (error) {
      message.error('获取问卷详情失败');
    }
  };

  const handleAddQuestion = (position?: 'above' | 'below', afterId?: string) => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      type: 'text',
      title: '',
      required: false,
      options: []
    };
    
    if (!position || !afterId) {
      // 默认在末尾添加
      setQuestions([...questions, newQuestion]);
      return;
    }
    
    if (position === 'above') {
      // 在指定问题之前插入
      const index = questions.findIndex(q => q.id === afterId);
      const newQuestions = [...questions];
      newQuestions.splice(index, 0, newQuestion);
      setQuestions(newQuestions);
    } else {
      // 在指定问题之后插入
      const index = questions.findIndex(q => q.id === afterId);
      const newQuestions = [...questions];
      newQuestions.splice(index + 1, 0, newQuestion);
      setQuestions(newQuestions);
    }
  };

  // 上移问题
  const handleMoveQuestionUp = (questionId: string) => {
    const index = questions.findIndex(q => q.id === questionId);
    if (index > 0) {
      const newQuestions = [...questions];
      [newQuestions[index - 1], newQuestions[index]] = [newQuestions[index], newQuestions[index - 1]];
      setQuestions(newQuestions);
      message.success('已上移一道题');
    } else {
      message.warning('已经是第一题');
    }
  };

  // 下移问题
  const handleMoveQuestionDown = (questionId: string) => {
    const index = questions.findIndex(q => q.id === questionId);
    if (index < questions.length - 1) {
      const newQuestions = [...questions];
      [newQuestions[index], newQuestions[index + 1]] = [newQuestions[index + 1], newQuestions[index]];
      setQuestions(newQuestions);
      message.success('已下移一道题');
    } else {
      message.warning('已经是最后一题');
    }
  };

  // 在指定位置添加新分区
  const handleAddSectionAtPosition = (afterQuestionId?: string) => {
    const newSection: Section = {
      id: Date.now().toString(),
      title: '',
      description: ''
    };
    setEditingSection(newSection);
    setSectionModalVisible(true);
  };

  const handleDeleteQuestion = (questionId: string) => {
    setQuestions(questions.filter(q => q.id !== questionId));
  };

  const handleQuestionChange = (questionId: string, field: keyof Question, value: any) => {
    setQuestions(questions.map(q => 
      q.id === questionId ? { ...q, [field]: value } : q
    ));
  };

  const handleAddOption = (questionId: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          options: [...(q.options || []), '']
        };
      }
      return q;
    }));
  };

  const handleDeleteOption = (questionId: string, index: number) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        return {
          ...q,
          options: (q.options || []).filter((_, i) => i !== index)
        };
      }
      return q;
    }));
  };

  const handleOptionChange = (questionId: string, index: number, value: string) => {
    setQuestions(questions.map(q => {
      if (q.id === questionId) {
        const newOptions = [...(q.options || [])];
        newOptions[index] = value;
        return { ...q, options: newOptions };
      }
      return q;
    }));
  };

  const handleImageUpload = async (questionId: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      handleQuestionChange(questionId, 'imageUrl', response.data.path);
      message.success('图片上传成功');
    } catch (error) {
      message.error('图片上传失败');
    }
  };

  const handleImageDelete = (questionId: string) => {
    handleQuestionChange(questionId, 'imageUrl', '');
  };

  // 标题背景图上传
  const handleTitleImageUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setTitleImageUrl(response.data.path);
      message.success('背景图上传成功');
    } catch (error) {
      message.error('背景图上传失败');
    }
  };

  // 分区管理函数
  const handleAddSection = () => {
    setEditingSection({ id: Date.now().toString(), title: '', description: '' });
    setSectionModalVisible(true);
  };

  const handleEditSection = (section: Section) => {
    setEditingSection({ ...section });
    setSectionModalVisible(true);
  };

  const handleDeleteSection = (sectionId: string) => {
    setSections(sections.filter(s => s.id !== sectionId));
    // 清除该分区下问题的sectionId
    setQuestions(questions.map(q => q.sectionId === sectionId ? { ...q, sectionId: undefined } : q));
    message.success('分区已删除');
  };

  const handleSaveSection = () => {
    if (!editingSection?.title) {
      message.error('请输入分区标题');
      return;
    }
    
    const existingIndex = sections.findIndex(s => s.id === editingSection.id);
    if (existingIndex >= 0) {
      const newSections = [...sections];
      newSections[existingIndex] = editingSection;
      setSections(newSections);
    } else {
      setSections([...sections, editingSection]);
    }
    setSectionModalVisible(false);
    setEditingSection(null);
  };

  // 分支逻辑函数
  const handleAddBranch = () => {
    const singleChoiceQuestions = questions.filter(q => q.type === 'singleChoice');
    if (singleChoiceQuestions.length === 0) {
      message.warning('需要先添加单选题才能设置分支逻辑');
      return;
    }
    setEditingBranch({
      id: Date.now().toString(),
      sourceQuestionId: singleChoiceQuestions[0].id,
      sourceOption: singleChoiceQuestions[0].options?.[0] || '',
      action: 'skip',
      skipCount: 1
    });
    setBranchModalVisible(true);
  };

  const handleEditBranch = (branch: BranchLogic) => {
    setEditingBranch({ ...branch });
    setBranchModalVisible(true);
  };

  const handleDeleteBranch = (branchId: string) => {
    setBranchLogics(branchLogics.filter(b => b.id !== branchId));
    message.success('分支逻辑已删除');
  };

  const handleSaveBranch = () => {
    if (!editingBranch?.sourceQuestionId || !editingBranch?.sourceOption) {
      message.error('请完善分支逻辑设置');
      return;
    }
    
    const existingIndex = branchLogics.findIndex(b => b.id === editingBranch.id);
    if (existingIndex >= 0) {
      const newBranchLogics = [...branchLogics]
      newBranchLogics[existingIndex] = editingBranch;
      setBranchLogics(newBranchLogics);
    } else {
      setBranchLogics([...branchLogics, editingBranch]);
    }
    setBranchModalVisible(false);
    setEditingBranch(null);
  };

  // 为问题分配分区
  const handleQuestionSectionChange = (questionId: string, sectionId: string | undefined) => {
    handleQuestionChange(questionId, 'sectionId', sectionId || undefined);
  };

  const handlePreviewImage = (imageUrl: string) => {
    setCurrentImage(imageUrl);
    setImageModalVisible(true);
  };

  const handleSave = async (status: 'draft' | 'published') => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      
      const surveyData: SurveyData = {
        id,
        ...values,
        titleImageUrl,
        sections,
        branchLogics,
        status,
        questions
      };
      
      if (id) {
        await axios.put(`/api/surveys/${id}`, surveyData);
        message.success('保存成功');
      } else {
        await axios.post('/api/surveys', surveyData);
        message.success('创建成功');
      }
      
      navigate('/surveys');
    } catch (error) {
      message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  const getQuestionTypeLabel = (type: string) => {
    const labels: any = {
      text: '填空题',
      textarea: '问答题',
      singleChoice: '单选题',
      multipleChoice: '多选题',
      fileUpload: '文件上传'
    };
    return labels[type] || type;
  };

  // 预览问卷
  const handlePreview = async () => {
    if (!id) {
      message.warning('请先保存问卷后再预览');
      return;
    }
    window.open(`/survey/${id}`, '_blank');
  };

  // 测试问卷（逐一模式）
  const handleTest = async () => {
    if (!id) {
      message.warning('请先保存问卷后再测试');
      return;
    }
    window.open(`/survey/${id}/sequential`, '_blank');
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <Title level={2}>{id ? '编辑问卷' : '创建新问卷'}</Title>
        <Space wrap>
          {id && (
            <>
              <Button 
                icon={<EyeOutlined />}
                onClick={handlePreview}
              >
                预览
              </Button>
              <Button 
                icon={<PlayCircleOutlined />}
                onClick={handleTest}
              >
                测试
              </Button>
            </>
          )}
          <Button 
            onClick={() => navigate('/surveys')}
          >
            取消
          </Button>
          <Button 
            type="default"
            icon={<SaveOutlined />}
            loading={loading}
            onClick={() => handleSave('draft')}
          >
            保存草稿
          </Button>
          <Button 
            type="primary"
            icon={<SaveOutlined />}
            loading={loading}
            onClick={() => handleSave('published')}
          >
            发布问卷
          </Button>
        </Space>
      </div>

      <Card>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            status: 'draft',
            questions: []
          }}
        >
          <Form.Item
            label="问卷标题"
            name="title"
            rules={[{ required: true, message: '请输入问卷标题' }]}
          >
            <Input 
              placeholder="请输入问卷标题" 
              size="large"
              showCount
              maxLength={200}
            />
          </Form.Item>

          <Form.Item
            label="问卷描述"
            name="description"
          >
            <TextArea 
              placeholder="请输入问卷描述"
              rows={3}
              showCount
              maxLength={500}
            />
          </Form.Item>

          {/* 标题背景图上传 */}
          <Form.Item
            label="标题背景图"
            extra="上传后将在问卷填写页面显示为标题背景"
          >
            {titleImageUrl ? (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <Image
                  width={300}
                  src={titleImageUrl}
                  alt="标题背景图"
                  style={{ borderRadius: '8px' }}
                />
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => setTitleImageUrl('')}
                  style={{ position: 'absolute', top: 8, right: 8 }}
                >
                  删除
                </Button>
              </div>
            ) : (
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={(file) => {
                  handleTitleImageUpload(file);
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />}>上传背景图</Button>
              </Upload>
            )}
          </Form.Item>

          <Form.Item
            label="答题模式"
            name="sequentialMode"
            valuePropName="checked"
            extra="开启后，问题将逐一显示，用户回答完上一题后才能看到下一题"
          >
            <Switch checkedChildren="逐一显示" unCheckedChildren="全部显示" />
          </Form.Item>
        </Form>

        <Divider />

        <div style={{ marginBottom: 16 }}>
          <Title level={4}>问题列表</Title>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Button 
              type="dashed" 
              onClick={handleAddQuestion} 
              block
              icon={<PlusOutlined />}
              size="large"
            >
              手动添加问题
            </Button>
            <Button 
              type="dashed" 
              onClick={() => setFormsImportVisible(true)} 
              block
              icon={<LinkOutlined style={{ color: '#0078d4' }} />}
              size="large"
            >
              从 Microsoft Forms 导入
            </Button>
            <Button 
              type="dashed" 
              onClick={() => setExcelImportVisible(true)} 
              block
              icon={<FileExcelOutlined style={{ color: '#217346' }} />}
              size="large"
            >
              从 Excel 导入问题
            </Button>
            <Button 
              type="dashed" 
              onClick={() => setPdfImportVisible(true)} 
              block
              icon={<FilePdfOutlined />}
              size="large"
            >
              从 PDF 导入问题
            </Button>
          </Space>
        </div>

        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {questions.map((question, index) => {
            // 构建问题操作菜单
            const questionMenuItems: MenuProps['items'] = [
              {
                key: 'moveUp',
                label: '上移一道题',
                icon: <ArrowUpOutlined />,
                disabled: index === 0,
                onClick: () => handleMoveQuestionUp(question.id)
              },
              {
                key: 'moveDown',
                label: '下移一道题',
                icon: <ArrowDownOutlined />,
                disabled: index === questions.length - 1,
                onClick: () => handleMoveQuestionDown(question.id)
              },
              { type: 'divider' },
              {
                key: 'addAbove',
                label: '在上方添加新问题',
                icon: <PlusOutlined />,
                onClick: () => handleAddQuestion('above', question.id)
              },
              {
                key: 'addBelow',
                label: '在下方添加新问题',
                icon: <PlusOutlined />,
                onClick: () => handleAddQuestion('below', question.id)
              },
              { type: 'divider' },
              {
                key: 'addSection',
                label: '添加新分区',
                icon: <FolderOutlined />,
                onClick: () => handleAddSectionAtPosition(question.id)
              },
              { type: 'divider' },
              {
                key: 'delete',
                label: '删除此题',
                icon: <DeleteOutlined />,
                danger: true,
                onClick: () => handleDeleteQuestion(question.id)
              }
            ];

            return (
            <Card 
              key={question.id}
              className="survey-question"
              title={
                <Space>
                  <Text strong>问题 {index + 1}</Text>
                  <Select
                    value={question.type}
                    onChange={(value) => handleQuestionChange(question.id, 'type', value)}
                    style={{ minWidth: 100 }}
                  >
                    <Option value="text">填空题</Option>
                    <Option value="textarea">问答题</Option>
                    <Option value="singleChoice">单选题</Option>
                    <Option value="multipleChoice">多选题</Option>
                    <Option value="fileUpload">文件上传</Option>
                  </Select>
                  <Switch
                    checked={question.required}
                    onChange={(checked) => handleQuestionChange(question.id, 'required', checked)}
                    checkedChildren="必填"
                    unCheckedChildren="选填"
                  />
                  <Dropdown 
                    menu={{ items: questionMenuItems }} 
                    trigger={['click']}
                    placement="bottomRight"
                  >
                    <Button type="text" icon={<MoreOutlined />} />
                  </Dropdown>
                </Space>
              }
            >
              <Form.Item
                label="问题标题"
                required={question.required}
              >
                <Input
                  value={question.title}
                  onChange={(e) => handleQuestionChange(question.id, 'title', e.target.value)}
                  placeholder="请输入问题标题"
                  showCount
                  maxLength={200}
                />
              </Form.Item>

              <Form.Item label="问题描述">
                <TextArea
                  value={question.description}
                  onChange={(e) => handleQuestionChange(question.id, 'description', e.target.value)}
                  placeholder="请输入问题描述（可选）"
                  rows={2}
                  maxLength={500}
                />
              </Form.Item>

              {/* 图片上传 */}
              <Form.Item label="示例图片">
                {question.imageUrl ? (
                  <div style={{ position: 'relative' }}>
                    <Image
                      width={200}
                      src={question.imageUrl}
                      alt="示例图片"
                      preview={{
                        visible: imageModalVisible && currentImage === question.imageUrl,
                        onVisibleChange: (vis) => !vis && setImageModalVisible(false)
                      }}
                    />
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleImageDelete(question.id)}
                      style={{ marginLeft: 8 }}
                    >
                      删除
                    </Button>
                  </div>
                ) : (
                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    beforeUpload={(file) => {
                      handleImageUpload(question.id, file);
                      return false;
                    }}
                  >
                    <Button icon={<UploadOutlined />}>上传图片</Button>
                  </Upload>
                )}
              </Form.Item>

              {/* 选项设置 */}
              {(question.type === 'singleChoice' || question.type === 'multipleChoice') && (
                <div className="question-options">
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>选项列表</Text>
                    <Tooltip title="至少需要两个选项">
                      <InfoCircleOutlined style={{ marginLeft: 4, color: '#999' }} />
                    </Tooltip>
                    <Text type="secondary" style={{ marginLeft: 8 }}>（点击选项右侧设置跳转逻辑）</Text>
                  </div>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {(question.options || []).map((option, optIndex) => {
                      // 获取当前选项的跳转设置
                      const currentJump = question.optionJumps?.find(j => j.optionText === option);
                      
                      return (
                      <div key={optIndex}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Input
                            value={option}
                            onChange={(e) => handleOptionChange(question.id, optIndex, e.target.value)}
                            placeholder={`选项 ${optIndex + 1}`}
                            showCount
                            maxLength={100}
                            style={{ flex: 1 }}
                          />
                          <Select
                            value={currentJump?.jumpType || 'next'}
                            onChange={(value) => {
                              const newJumps = [...(question.optionJumps || [])];
                              const existIndex = newJumps.findIndex(j => j.optionText === option);
                              const jumpData: OptionJump = {
                                optionText: option,
                                jumpType: value,
                                targetQuestionId: value === 'question' ? questions.find(q => q.id !== question.id)?.id : undefined
                              };
                              if (existIndex >= 0) {
                                newJumps[existIndex] = jumpData;
                              } else {
                                newJumps.push(jumpData);
                              }
                              // 移除 next 类型的跳转设置
                              const filteredJumps = value === 'next' 
                                ? newJumps.filter(j => j.optionText !== option)
                                : newJumps;
                              handleQuestionChange(question.id, 'optionJumps', filteredJumps);
                            }}
                            style={{ width: 120 }}
                            placeholder="跳转设置"
                          >
                            <Option value="next">下一题</Option>
                            <Option value="question">跳转到题</Option>
                            <Option value="end">结束答题</Option>
                          </Select>
                          {currentJump?.jumpType === 'question' && (
                            <Select
                              value={currentJump.targetQuestionId}
                              onChange={(value) => {
                                const newJumps = [...(question.optionJumps || [])];
                                const existIndex = newJumps.findIndex(j => j.optionText === option);
                                if (existIndex >= 0) {
                                  newJumps[existIndex] = { ...newJumps[existIndex], targetQuestionId: value };
                                  handleQuestionChange(question.id, 'optionJumps', newJumps);
                                }
                              }}
                              style={{ width: 150 }}
                              placeholder="选择目标题目"
                            >
                              {questions.filter(q => q.id !== question.id).map((q, qIdx) => (
                                <Option key={q.id} value={q.id}>问题{qIdx + 1}</Option>
                              ))}
                            </Select>
                          )}
                          <Button
                            type="text"
                            danger
                            icon={<MinusCircleOutlined />}
                            onClick={() => handleDeleteOption(question.id, optIndex)}
                          />
                        </div>
                        {/* 显示跳转提示 */}
                        {currentJump && currentJump.jumpType !== 'next' && (
                          <div style={{ marginTop: 4, marginLeft: 4, fontSize: 12, color: '#1890ff' }}>
                            {currentJump.jumpType === 'question' 
                              ? `→ 跳转到：问题${questions.findIndex(q => q.id === currentJump.targetQuestionId) + 1}`
                              : '→ 结束答题'
                            }
                          </div>
                        )}
                      </div>
                    );
                    })}
                    <Button 
                      type="dashed" 
                      onClick={() => handleAddOption(question.id)}
                      icon={<PlusOutlined />}
                    >
                      添加选项
                    </Button>
                  </Space>
                </div>
              )}

              <div className="question-actions">
                <Space>
                  <Text type="secondary">类型: {getQuestionTypeLabel(question.type)}</Text>
                  <Select
                    value={question.sectionId}
                    onChange={(value) => handleQuestionSectionChange(question.id, value)}
                    placeholder="选择分区"
                    allowClear
                    style={{ width: 150 }}
                  >
                    {sections.map(section => (
                      <Option key={section.id} value={section.id}>{section.title}</Option>
                    ))}
                  </Select>
                </Space>
              </div>
            </Card>
            );
          })}
        </Space>
      </Card>

      {/* 分区管理和分支逻辑 */}
      <Divider />

      <Card 
        title={<Title level={4} style={{ margin: 0 }}>分区与分支设置</Title>}
        style={{ marginTop: 16 }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div style={{ display: 'flex', gap: 16 }}>
            <Button 
              type="dashed" 
              onClick={handleAddSection}
              icon={<PlusOutlined />}
            >
              添加分区
            </Button>
            <Button 
              type="dashed" 
              onClick={handleAddBranch}
              icon={<LinkOutlined />}
            >
              添加分支逻辑
            </Button>
            {(branchLogics.length > 0 || questions.some(q => q.optionJumps?.length)) && (
              <Button 
                type="dashed" 
                onClick={() => setJumpPreviewVisible(!jumpPreviewVisible)}
                icon={<NodeIndexOutlined />}
                danger={jumpPreviewVisible}
              >
                {jumpPreviewVisible ? '收起跳转预览' : '查看跳转预览'}
              </Button>
            )}
          </div>
          
          {/* 跳转预览视图 */}
          {jumpPreviewVisible && (
            <Card 
              type="inner" 
              title={<Text strong>跳转流程预览</Text>}
              style={{ background: '#f5f5f5', marginTop: 8 }}
            >
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {questions.map((q, idx) => {
                  // 收集该问题的所有跳转规则
                  const jumps: Array<{type: string, text: string, color: string}> = [];
                  
                  // 选项级跳转
                  if (q.optionJumps?.length) {
                    q.optionJumps.forEach(jump => {
                      if (jump.jumpType === 'end') {
                        jumps.push({ type: 'end', text: `选择"${jump.optionText}"→结束`, color: '#ff4d4f' });
                      } else if (jump.jumpType === 'question' && jump.targetQuestionId) {
                        const targetIdx = questions.findIndex(q => q.id === jump.targetQuestionId);
                        if (targetIdx !== -1) {
                          jumps.push({ type: 'jump', text: `选择"${jump.optionText}"→问题${targetIdx + 1}`, color: '#1890ff' });
                        }
                      }
                    });
                  }
                  
                  // 全局分支逻辑
                  const globalBranch = branchLogics.find(b => b.sourceQuestionId === q.id);
                  if (globalBranch) {
                    if (globalBranch.action === 'skip' && globalBranch.skipCount) {
                      jumps.push({ type: 'skip', text: `"${globalBranch.sourceOption}"时跳过${globalBranch.skipCount}题`, color: '#faad14' });
                    } else if (globalBranch.action === 'jump' && globalBranch.targetQuestionId) {
                      const targetIdx = questions.findIndex(q => q.id === globalBranch.targetQuestionId);
                      if (targetIdx !== -1) {
                        jumps.push({ type: 'jump', text: `"${globalBranch.sourceOption}"→问题${targetIdx + 1}`, color: '#1890ff' });
                      }
                    }
                  }
                  
                  if (jumps.length === 0) return null;
                  
                  return (
                    <div key={q.id} style={{ marginBottom: 12, padding: '8px 12px', background: '#fff', borderRadius: 6 }}>
                      <Space>
                        <Tag color="default">问题{idx + 1}</Tag>
                        <Text strong style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {q.title || '(未填写标题)'}
                        </Text>
                      </Space>
                      <div style={{ marginTop: 6, marginLeft: 60 }}>
                        {jumps.map((j, jIdx) => (
                          <Tag key={jIdx} color={j.color} style={{ marginBottom: 4 }}>
                            {j.type === 'end' ? <StopOutlined /> : j.type === 'skip' ? <RightOutlined /> : <RightOutlined />}
                            {' '}{j.text}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {questions.filter(q => 
                  !q.optionJumps?.length && 
                  !branchLogics.some(b => b.sourceQuestionId === q.id)
                ).length === questions.length && questions.length > 0 && (
                  <Alert 
                    message="暂无跳转规则" 
                    description="点击上方「添加分支逻辑」或为选项设置跳转" 
                    type="info" 
                    showIcon 
                  />
                )}
              </div>
            </Card>
          )}

          {/* 分区列表 */}
          {sections.length > 0 && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>分区列表：</Text>
              <Space direction="vertical" style={{ width: '100%' }}>
                {sections.map((section, index) => (
                  <Card key={section.id} size="small">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <Text strong>{index + 1}. {section.title}</Text>
                        {section.description && <Text type="secondary"> - {section.description}</Text>}
                      </div>
                      <Space>
                        <Button type="link" onClick={() => handleEditSection(section)}>编辑</Button>
                        <Button type="link" danger onClick={() => handleDeleteSection(section.id)}>删除</Button>
                      </Space>
                    </div>
                  </Card>
                ))}
              </Space>
            </div>
          )}

          {/* 分支逻辑列表 */}
          {branchLogics.length > 0 && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>分支逻辑：</Text>
              <Space direction="vertical" style={{ width: '100%' }}>
                {branchLogics.map(branch => {
                  const sourceQuestion = questions.find(q => q.id === branch.sourceQuestionId);
                  return (
                    <Card key={branch.id} size="small">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text>
                          当选择「{sourceQuestion?.title || branch.sourceQuestionId}」的「{branch.sourceOption}」时，
                          {branch.action === 'skip' 
                            ? ` 跳过 ${branch.skipCount} 道题` 
                            : ` 跳转到「${branch.targetQuestionId}」`
                          }
                        </Text>
                        <Space>
                          <Button type="link" onClick={() => handleEditBranch(branch)}>编辑</Button>
                          <Button type="link" danger onClick={() => handleDeleteBranch(branch.id)}>删除</Button>
                        </Space>
                      </div>
                    </Card>
                  );
                })}
              </Space>
            </div>
          )}
        </Space>
      </Card>

      {/* 分区编辑Modal */}
      <Modal
        title={editingSection?.id ? '编辑分区' : '添加分区'}
        open={sectionModalVisible}
        onOk={handleSaveSection}
        onCancel={() => { setSectionModalVisible(false); setEditingSection(null); }}
      >
        <Form layout="vertical">
          <Form.Item label="分区标题" required>
            <Input
              value={editingSection?.title || ''}
              onChange={(e) => setEditingSection({ ...editingSection!, title: e.target.value })}
              placeholder="请输入分区标题"
            />
          </Form.Item>
          <Form.Item label="分区描述">
            <Input
              value={editingSection?.description || ''}
              onChange={(e) => setEditingSection({ ...editingSection!, description: e.target.value })}
              placeholder="请输入分区描述（可选）"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 分支逻辑编辑Modal */}
      <Modal
        title={editingBranch?.id ? '编辑分支逻辑' : '添加分支逻辑'}
        open={branchModalVisible}
        onOk={handleSaveBranch}
        onCancel={() => { setBranchModalVisible(false); setEditingBranch(null); }}
        width="90%"
        style={{ maxWidth: 600 }}
      >
        <Form layout="vertical">
          <Form.Item label="触发问题">
            <Select
              value={editingBranch?.sourceQuestionId}
              onChange={(value) => {
                const question = questions.find(q => q.id === value);
                setEditingBranch({
                  ...editingBranch!,
                  sourceQuestionId: value,
                  sourceOption: question?.options?.[0] || ''
                });
              }}
              style={{ width: '100%' }}
            >
              {questions.filter(q => q.type === 'singleChoice').map(q => (
                <Option key={q.id} value={q.id}>{q.title}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="触发选项">
            <Select
              value={editingBranch?.sourceOption}
              onChange={(value) => setEditingBranch({ ...editingBranch!, sourceOption: value })}
              style={{ width: '100%' }}
            >
              {questions
                .find(q => q.id === editingBranch?.sourceQuestionId)
                ?.options?.map((opt, idx) => (
                  <Option key={idx} value={opt}>{opt}</Option>
                ))
              }
            </Select>
          </Form.Item>
          <Form.Item label="执行动作">
            <Radio.Group
              value={editingBranch?.action}
              onChange={(e) => setEditingBranch({ ...editingBranch!, action: e.target.value })}
            >
              <Radio value="skip">跳过题目</Radio>
              <Radio value="jump">跳转到指定题目</Radio>
            </Radio.Group>
          </Form.Item>
          {editingBranch?.action === 'skip' ? (
            <Form.Item label="跳过题目数量">
              <InputNumber
                min={1}
                max={questions.length}
                value={editingBranch?.skipCount || 1}
                onChange={(value) => setEditingBranch({ ...editingBranch!, skipCount: value })}
              />
            </Form.Item>
          ) : (
            <Form.Item label="跳转目标题目">
              <Select
                value={editingBranch?.targetQuestionId}
                onChange={(value) => setEditingBranch({ ...editingBranch!, targetQuestionId: value })}
                style={{ width: '100%' }}
                placeholder="选择跳转目标"
              >
                {questions.map((q, idx) => (
                  <Option key={q.id} value={q.id}>问题{idx + 1}: {q.title}</Option>
                ))}
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* PDF 导入组件 */}
      <PDFImport
        visible={pdfImportVisible}
        onClose={() => setPdfImportVisible(false)}
        onImport={(importedQuestions) => {
          setQuestions([...questions, ...importedQuestions]);
          message.success(`成功导入 ${importedQuestions.length} 个问题`);
        }}
      />

      {/* Excel 导入组件 */}
      <ExcelImport
        visible={excelImportVisible}
        onClose={() => setExcelImportVisible(false)}
        onImport={(importedQuestions) => {
          setQuestions([...questions, ...importedQuestions]);
          message.success(`成功导入 ${importedQuestions.length} 个问题`);
        }}
      />

      {/* Microsoft Forms 导入组件 */}
      <FormsImport
        visible={formsImportVisible}
        onClose={() => setFormsImportVisible(false)}
        onImport={(importedQuestions) => {
          setQuestions([...questions, ...importedQuestions]);
          message.success(`成功导入 ${importedQuestions.length} 个问题`);
        }}
      />
    </div>
  );
};

export default SurveyEditor;

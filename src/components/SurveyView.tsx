import React, { useState, useEffect } from 'react';
import { 
  Form, 
  Input, 
  Button, 
  Card, 
  Radio, 
  Checkbox, 
  Upload, 
  message, 
  Typography,
  Space,
  Alert,
  Image
} from 'antd';
import { 
  UploadOutlined, 
  SendOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

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
  optionJumps?: OptionJump[];
  imageUrl?: string;
  sectionId?: string;
}

interface Survey {
  id: string;
  title: string;
  description: string;
  titleImageUrl?: string;
  sections: Section[];
  branchLogics: BranchLogic[];
  questions: Question[];
}

const SurveyView: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [fileList, setFileList] = useState<any[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      fetchSurvey(id);
    }
  }, [id]);

  const fetchSurvey = async (surveyId: string) => {
    try {
      const response = await axios.get(`/api/surveys/${surveyId}`);
      setSurvey(response.data);
    } catch (error) {
      message.error('问卷不存在或已关闭');
      navigate('/');
    }
  };

  const handleFileChange = (questionId: string, info: any) => {
    const newFileList = [...fileList];
    const index = newFileList.findIndex(f => f.questionId === questionId);
    
    if (index >= 0) {
      newFileList[index] = { questionId, files: info.fileList };
    } else {
      newFileList.push({ questionId, files: info.fileList });
    }
    
    setFileList(newFileList);
  };

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      
      // 准备文件
      const formData = new FormData();
      fileList.forEach(item => {
        item.files.forEach((file: any) => {
          if (file.originFileObj) {
            formData.append('files', file.originFileObj);
          }
        });
      });
      
      // 准备答案
      formData.append('answers', JSON.stringify(values));
      
      await axios.post(`/api/surveys/${id}/responses`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      message.success('提交成功！');
      setSubmitted(true);
    } catch (error) {
      message.error('提交失败，请重试');
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

  const renderQuestionInput = (question: Question) => {
    switch (question.type) {
      case 'text':
        return (
          <Form.Item
            name={question.id}
            rules={[{ required: question.required, message: '请输入答案' }]}
          >
            <Input placeholder="请输入答案" />
          </Form.Item>
        );
      
      case 'textarea':
        return (
          <Form.Item
            name={question.id}
            rules={[{ required: question.required, message: '请输入答案' }]}
          >
            <TextArea 
              rows={4} 
              placeholder="请输入答案"
              showCount
              maxLength={2000}
            />
          </Form.Item>
        );
      
      case 'singleChoice':
        return (
          <Form.Item
            name={question.id}
            rules={[{ required: question.required, message: '请选择一个选项' }]}
          >
            <Radio.Group style={{ width: '100%' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {question.options?.map((option, index) => (
                  <Radio key={index} value={option}>{option}</Radio>
                ))}
              </Space>
            </Radio.Group>
          </Form.Item>
        );
      
      case 'multipleChoice':
        return (
          <Form.Item
            name={question.id}
            rules={[{ required: question.required, message: '请至少选择一个选项' }]}
          >
            <Checkbox.Group style={{ width: '100%' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {question.options?.map((option, index) => (
                  <Checkbox key={index} value={option}>{option}</Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </Form.Item>
        );
      
      case 'fileUpload':
        return (
          <Form.Item
            name={question.id}
            rules={[{ required: question.required, message: '请上传文件' }]}
          >
            <Upload
              listType="picture-card"
              fileList={fileList.find(f => f.questionId === question.id)?.files || []}
              onChange={(info) => handleFileChange(question.id, info)}
              beforeUpload={() => false}
              maxCount={5}
            >
              <div>
                <UploadOutlined />
                <div style={{ marginTop: 8 }}>上传文件</div>
              </div>
            </Upload>
            <Text type="secondary">支持图片、文档等文件，单文件不超过10MB</Text>
          </Form.Item>
        );
      
      default:
        return null;
    }
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px' }}>
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>✓</div>
            <Title level={2}>提交成功</Title>
            <Paragraph>
              感谢您的参与！您的答卷已成功提交。
            </Paragraph>
            <Button 
              type="primary" 
              onClick={() => navigate('/')}
              style={{ marginTop: 24 }}
            >
              返回首页
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!survey) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>加载中...</div>;
  }

  // 按分区组织问题
  const getQuestionsBySection = () => {
    const sectionMap = new Map<string | undefined, Question[]>();
    sectionMap.set(undefined, []);
    
    survey.sections?.forEach(section => {
      sectionMap.set(section.id, []);
    });
    
    survey.questions.forEach(question => {
      const sectionId = question.sectionId;
      if (!sectionMap.has(sectionId)) {
        sectionMap.set(sectionId, []);
      }
      sectionMap.get(sectionId)?.push(question);
    });
    
    return sectionMap;
  };

  const questionsBySection = getQuestionsBySection();
  const sectionsWithQuestions = [
    ...(survey.sections || []),
    ...(questionsBySection.has(undefined) && questionsBySection.get(undefined)?.length ? [{ id: '__ungrouped', title: '其他问题' }] : [])
  ];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px' }}>
      <Card>
        {/* 标题区域，支持背景图 */}
        <div 
          style={{ 
            textAlign: 'center', 
            marginBottom: 32,
            padding: survey.titleImageUrl ? '40px 20px' : '20px',
            backgroundImage: survey.titleImageUrl ? `url(${survey.titleImageUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            borderRadius: survey.titleImageUrl ? '8px' : 0,
            color: survey.titleImageUrl ? '#fff' : 'inherit',
            textShadow: survey.titleImageUrl ? '0 2px 4px rgba(0,0,0,0.5)' : 'none'
          }}
        >
          <Title level={2} style={{ color: survey.titleImageUrl ? '#fff' : 'inherit', marginBottom: 8 }}>
            {survey.title}
          </Title>
          {survey.description && (
            <Paragraph style={{ color: survey.titleImageUrl ? '#fff' : 'inherit', fontSize: '16px' }}>
              {survey.description}
            </Paragraph>
          )}
        </div>

        <Alert
          message="填写提示"
          description="带 * 的问题为必填项，请确保完整填写后提交。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* 渲染分区 */}
            {sectionsWithQuestions.map((section, sectionIndex) => {
              const sectionQuestions = questionsBySection.get(section.id === '__ungrouped' ? undefined : section.id) || [];
              if (sectionQuestions.length === 0) return null;
              
              return (
                <div key={section.id}>
                  {/* 分区标题 */}
                  {section.id !== '__ungrouped' && (
                    <div style={{ marginBottom: 16, paddingBottom: 8, borderBottom: '2px solid #1890ff' }}>
                      <Title level={4} style={{ margin: 0, color: '#1890ff' }}>
                        {section.title}
                      </Title>
                      {section.description && (
                        <Text type="secondary">{section.description}</Text>
                      )}
                    </div>
                  )}
                  
                  {/* 分区下的问题 */}
                  {sectionQuestions.map((question, index) => {
                    const globalIndex = survey.questions.findIndex(q => q.id === question.id);
                    return (
                      <Card key={question.id} className="survey-question">
                        <div style={{ marginBottom: 16 }}>
                          <Space>
                            <Text strong>问题 {globalIndex + 1}</Text>
                            <Text type="secondary">({getQuestionTypeLabel(question.type)})</Text>
                            {question.required && <Text type="danger">*</Text>}
                          </Space>
                        </div>
                        
                        <Title level={4}>{question.title}</Title>
                        
                        {question.description && (
                          <Paragraph type="secondary">{question.description}</Paragraph>
                        )}

                        {question.imageUrl && (
                          <div style={{ marginBottom: 16 }}>
                            <Text type="secondary">示例图片：</Text>
                            <div style={{ marginTop: 8 }}>
                              <Image
                                width="100%"
                                style={{ maxWidth: 300 }}
                                src={question.imageUrl}
                                alt="示例图片"
                              />
                            </div>
                          </div>
                        )}

                        {renderQuestionInput(question)}
                      </Card>
                    );
                  })}
                </div>
              );
            })}
          </Space>

          <div style={{ marginTop: 32, textAlign: 'center' }}>
            <Button
              type="primary"
              size="large"
              htmlType="submit"
              icon={<SendOutlined />}
              loading={loading}
              style={{ minWidth: 120, width: '100%', maxWidth: 200 }}
            >
              提交答卷
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default SurveyView;

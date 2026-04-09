import React, { useState, useEffect, useMemo } from 'react';
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
  Image,
  Progress,
  Steps,
  Tag,
  Popover,
  Tooltip
} from 'antd';
import { 
  UploadOutlined, 
  SendOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  RightCircleOutlined,
  QuestionCircleOutlined,
  StopOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface BranchLogic {
  id: string;
  sourceQuestionId: string;
  sourceOption: string;
  conditionType?: 'equals' | 'contains' | 'greaterThan' | 'lessThan'; // 条件类型
  action: 'skip' | 'jump' | 'end';
  skipCount?: number;
  targetQuestionId?: string;
}

interface Section {
  id: string;
  title: string;
  description?: string;
}

// 选项跳转设置 - 增强版
interface OptionJump {
  optionText: string;
  jumpType: 'next' | 'question' | 'end';
  targetQuestionId?: string;
  // 条件跳转：用于填空题/多选题
  conditionType?: 'equals' | 'contains' | 'notEmpty';
  conditionValue?: string;
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

interface Answer {
  [key: string]: any;
}

const SurveyViewSequential: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [visibleQuestionIndices, setVisibleQuestionIndices] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Answer>({});
  const [fileList, setFileList] = useState<any[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [showCover, setShowCover] = useState(true);
  const { id } = useParams();
  const navigate = useNavigate();

  // 检测循环跳转（死循环防护）
  const detectCycle = (startIndex: number, targetIndex: number, visited: Set<number>): boolean => {
    if (targetIndex <= startIndex) return true; // 循环回到之前的问题
    if (visited.has(targetIndex)) return true; // 重复访问
    return false;
  };

  // 计算可见问题索引（根据分支逻辑）
  useEffect(() => {
    if (!survey?.questions) return;
    
    const indices: number[] = [];
    const skipped = new Set<number>();
    const visitedJumpTargets = new Set<number>(); // 记录跳转到过的位置
    
    for (let i = 0; i < survey.questions.length; i++) {
      if (skipped.has(i)) continue;
      
      indices.push(i);
      
      // 检查是否有分支逻辑
      const question = survey.questions[i];
      const branchLogic = survey.branchLogics?.find(
        b => b.sourceQuestionId === question.id
      );
      
      if (branchLogic) {
        const currentAnswer = answers[question.id];
        if (currentAnswer === branchLogic.sourceOption) {
          if (branchLogic.action === 'skip' && branchLogic.skipCount) {
            // 跳过指定数量的题目
            for (let j = 1; j <= branchLogic.skipCount; j++) {
              if (i + j < survey.questions.length) {
                skipped.add(i + j);
              }
            }
          } else if (branchLogic.action === 'jump' && branchLogic.targetQuestionId) {
            // 跳转到指定题目
            const targetIndex = survey.questions.findIndex(
              q => q.id === branchLogic.targetQuestionId
            );
            if (targetIndex > i + 1) {
              for (let j = i + 1; j < targetIndex; j++) {
                skipped.add(j);
              }
            }
            // 检测循环
            if (detectCycle(i, targetIndex, visitedJumpTargets)) {
              console.warn(`检测到循环跳转：从问题${i + 1}跳转到问题${targetIndex + 1}`);
            }
            visitedJumpTargets.add(targetIndex);
          }
        }
      }
      
      // 同时检查选项级跳转
      if (question.optionJumps?.length) {
        const answer = answers[question.id];
        if (answer) {
          const optionJump = question.optionJumps.find(j => j.optionText === answer);
          if (optionJump?.jumpType === 'question' && optionJump.targetQuestionId) {
            const targetIdx = survey.questions.findIndex(q => q.id === optionJump.targetQuestionId);
            if (targetIdx > i + 1) {
              for (let j = i + 1; j < targetIdx; j++) {
                skipped.add(j);
              }
            }
            if (detectCycle(i, targetIdx, visitedJumpTargets)) {
              console.warn(`检测到循环跳转（选项级）：从问题${i + 1}跳转到问题${targetIdx + 1}`);
            }
            visitedJumpTargets.add(targetIdx);
          }
        }
      }
    }
    
    setVisibleQuestionIndices(indices);
  }, [survey?.questions, survey?.branchLogics, answers]);

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

  const handleNext = async () => {
    try {
      const currentQuestion = survey?.questions[visibleQuestionIndices[currentStep]];
      if (!currentQuestion) return;

      const values = await form.validateFields();
      const newAnswers = { ...answers, ...values };
      setAnswers(newAnswers);
      
      const currentAnswer = newAnswers[currentQuestion.id];
      let nextIndex = currentStep + 1;
      let isEnd = false;
      
      // 1. 检查选项跳转逻辑 (optionJumps) - 优先于全局分支逻辑
      if (currentQuestion.optionJumps && currentAnswer) {
        const optionJump = currentQuestion.optionJumps.find(j => j.optionText === currentAnswer);
        if (optionJump) {
          if (optionJump.jumpType === 'end') {
            // 结束答题
            isEnd = true;
          } else if (optionJump.jumpType === 'question' && optionJump.targetQuestionId) {
            // 跳转到指定问题
            const targetVisibleIndex = visibleQuestionIndices.findIndex(
              idx => survey?.questions[idx].id === optionJump.targetQuestionId
            );
            if (targetVisibleIndex !== -1) {
              nextIndex = targetVisibleIndex;
            }
          }
          // jumpType === 'next' 时保持默认行为
        }
      }
      
      // 2. 如果没有选项跳转，检查全局分支逻辑
      if (!isEnd && !currentQuestion.optionJumps?.find(j => j.optionText === currentAnswer)) {
        const branchLogic = survey?.branchLogics?.find(
          b => b.sourceQuestionId === currentQuestion.id
        );
        
        if (branchLogic && currentAnswer === branchLogic.sourceOption) {
          if (branchLogic.action === 'skip' && branchLogic.skipCount) {
            // 跳过指定数量的问题
            nextIndex = currentStep + 1 + branchLogic.skipCount;
          } else if (branchLogic.action === 'jump' && branchLogic.targetQuestionId) {
            // 跳转到指定问题
            const targetVisibleIndex = visibleQuestionIndices.findIndex(
              idx => survey?.questions[idx].id === branchLogic.targetQuestionId
            );
            if (targetVisibleIndex !== -1) {
              nextIndex = targetVisibleIndex;
            }
          }
        }
      }
      
      if (isEnd) {
        // 结束答题，提交表单
        handleSubmit();
      } else if (nextIndex < visibleQuestionIndices.length) {
        setCurrentStep(nextIndex);
        form.resetFields();
      }
    } catch (error) {
      message.error('请填写当前题目后再继续');
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      // 恢复之前的答案
      const previousAnswers: any = {};
      visibleQuestionIndices.slice(0, currentStep).forEach(idx => {
        const question = survey?.questions[idx];
        if (question && answers[question.id]) {
          previousAnswers[question.id] = answers[question.id];
        }
      });
      form.setFieldsValue(previousAnswers);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      // 获取当前答案
      const currentValues = await form.validateFields();
      const finalAnswers = { ...answers, ...currentValues };
      
      // 准备文件
      const formData = new FormData();
      fileList.forEach(item => {
        item.files.forEach((file: any) => {
          if (file.originFileObj) {
            formData.append('files', file.originFileObj);
          }
        });
      });
      
      // 准备答案 - 只包含可见问题的答案
      const filteredAnswers: Answer = {};
      visibleQuestionIndices.forEach(idx => {
        const question = survey?.questions[idx];
        if (question && finalAnswers[question.id] !== undefined) {
          filteredAnswers[question.id] = finalAnswers[question.id];
        }
      });
      
      formData.append('answers', JSON.stringify(filteredAnswers));
      
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

  const getProgress = () => {
    if (!visibleQuestionIndices.length) return 0;
    return ((currentStep + 1) / visibleQuestionIndices.length) * 100;
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
    // 获取填空题/问答题的条件跳转信息
    const getConditionJumpInfo = () => {
      const jumps = question.optionJumps || [];
      if (jumps.length === 0) return null;
      
      // 显示条件跳转提示
      return jumps.map((jump, idx) => {
        let conditionText = '';
        if (jump.conditionType === 'notEmpty') {
          conditionText = '填写任意内容';
        } else if (jump.conditionType === 'contains' && jump.conditionValue) {
          conditionText = `包含"${jump.conditionValue}"`;
        } else if (jump.conditionType === 'equals' && jump.conditionValue) {
          conditionText = `等于"${jump.conditionValue}"`;
        }
        
        if (!conditionText) return null;
        
        let actionText = '';
        if (jump.jumpType === 'end') {
          actionText = '结束答题';
        } else if (jump.jumpType === 'question' && jump.targetQuestionId) {
          const targetVisibleIndex = visibleQuestionIndices.findIndex(
            idx => survey?.questions[idx]?.id === jump.targetQuestionId
          );
          actionText = targetVisibleIndex !== -1 ? `跳转至问题${targetVisibleIndex + 1}` : '跳转';
        }
        
        return (
          <Tag key={idx} color={jump.jumpType === 'end' ? 'red' : 'blue'} style={{ marginTop: 8 }}>
            {conditionText} → {actionText}
          </Tag>
        );
      });
    };
    
    const jumpInfo = getConditionJumpInfo();
    
    switch (question.type) {
      case 'text':
        return (
          <div>
            <Form.Item
              name={question.id}
              rules={[{ required: question.required, message: '请输入答案' }]}
            >
              <Input 
                placeholder="请输入答案" 
                size="large"
                onChange={(e) => {
                  setAnswers({ ...answers, [question.id]: e.target.value });
                }}
              />
            </Form.Item>
            {jumpInfo && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <QuestionCircleOutlined /> 条件跳转提示：
                </Text>
                <div>{jumpInfo}</div>
              </div>
            )}
          </div>
        );
      
      case 'textarea':
        return (
          <div>
            <Form.Item
              name={question.id}
              rules={[{ required: question.required, message: '请输入答案' }]}
            >
              <TextArea 
                rows={6} 
                placeholder="请输入答案"
                showCount
                maxLength={2000}
                size="large"
                onChange={(e) => {
                  setAnswers({ ...answers, [question.id]: e.target.value });
                }}
              />
            </Form.Item>
            {jumpInfo && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <QuestionCircleOutlined /> 条件跳转提示：
                </Text>
                <div>{jumpInfo}</div>
              </div>
            )}
          </div>
        );
      
      case 'singleChoice':
        // 获取当前选项的跳转信息
        const getOptionJumpInfo = (optionText: string) => {
          const jumps = question.optionJumps || [];
          const jump = jumps.find(j => j.optionText === optionText);
          if (!jump) return null;
          
          if (jump.jumpType === 'end') {
            return { type: 'end', icon: <StopOutlined style={{ color: '#ff4d4f' }} />, text: '结束答题' };
          }
          if (jump.jumpType === 'question' && jump.targetQuestionId) {
            const targetIndex = survey?.questions.findIndex(q => q.id === jump.targetQuestionId) ?? -1;
            const targetVisibleIndex = visibleQuestionIndices.findIndex(
              idx => survey?.questions[idx]?.id === jump.targetQuestionId
            );
            return { 
              type: 'jump', 
              icon: <RightCircleOutlined style={{ color: '#1890ff' }} />, 
              text: targetIndex !== -1 ? `→ 跳转至问题${targetVisibleIndex + 1}` : '→ 跳转'
            };
          }
          return { type: 'next', icon: <ArrowRightOutlined style={{ color: '#52c41a' }} />, text: '→ 下一题' };
        };
        
        return (
          <Form.Item
            name={question.id}
            rules={[{ required: question.required, message: '请选择一个选项' }]}
          >
            <Radio.Group style={{ width: '100%' }} size="large">
              <Space direction="vertical" style={{ width: '100%' }}>
                {question.options?.map((option, index) => {
                  const jumpInfo = getOptionJumpInfo(option);
                  return (
                    <Radio 
                      key={index} 
                      value={option} 
                      style={{ 
                        padding: '16px 20px', 
                        border: '1px solid #d9d9d9', 
                        borderRadius: '8px', 
                        width: '100%',
                        marginLeft: 0,
                        background: answers[question.id] === option ? '#e6f7ff' : '#fff'
                      }}
                    >
                      <Space>
                        <span style={{ fontSize: '16px' }}>{option}</span>
                        {jumpInfo && (
                          <Tooltip title={jumpInfo.type === 'end' ? '选择后将结束答题' : `选择后将${jumpInfo.text.replace('→ ', '')}`}>
                            <Tag 
                              color={jumpInfo.type === 'end' ? 'red' : jumpInfo.type === 'jump' ? 'blue' : 'green'}
                              style={{ marginLeft: 8 }}
                            >
                              {jumpInfo.icon} {jumpInfo.text}
                            </Tag>
                          </Tooltip>
                        )}
                      </Space>
                    </Radio>
                  );
                })}
              </Space>
            </Radio.Group>
          </Form.Item>
        );
      
      case 'multipleChoice':
        // 获取多选题选项的跳转信息
        const getMultiOptionJumpInfo = (optionText: string) => {
          const jumps = question.optionJumps || [];
          const jump = jumps.find(j => j.optionText === optionText);
          if (!jump) return null;
          
          if (jump.jumpType === 'end') {
            return { type: 'end', icon: <StopOutlined style={{ color: '#ff4d4f' }} />, text: '结束答题' };
          }
          if (jump.jumpType === 'question' && jump.targetQuestionId) {
            const targetVisibleIndex = visibleQuestionIndices.findIndex(
              idx => survey?.questions[idx]?.id === jump.targetQuestionId
            );
            return { 
              type: 'jump', 
              icon: <RightCircleOutlined style={{ color: '#1890ff' }} />, 
              text: targetVisibleIndex !== -1 ? `→ 跳转至问题${targetVisibleIndex + 1}` : '→ 跳转'
            };
          }
          return { type: 'next', icon: <ArrowRightOutlined style={{ color: '#52c41a' }} />, text: '→ 下一题' };
        };
        
        // 多选题结束条件检测
        const checkMultiEndCondition = () => {
          const multiJumps = question.optionJumps || [];
          const currentAnswers = answers[question.id] as string[] || [];
          
          for (const jump of multiJumps) {
            if (jump.jumpType === 'end' && jump.conditionType === 'contains' && jump.conditionValue) {
              // 检查是否包含特定选项
              if (currentAnswers.includes(jump.conditionValue)) {
                return { willEnd: true, jump };
              }
            }
            if (jump.jumpType === 'end' && jump.conditionType === 'notEmpty') {
              // 只要选了任意选项就结束
              if (currentAnswers.length > 0) {
                return { willEnd: true, jump };
              }
            }
          }
          return { willEnd: false };
        };
        
        const multiEndCheck = checkMultiEndCondition();
        
        return (
          <Form.Item
            name={question.id}
            rules={[{ required: question.required, message: '请至少选择一个选项' }]}
          >
            <Checkbox.Group style={{ width: '100%' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {question.options?.map((option, index) => {
                  const jumpInfo = getMultiOptionJumpInfo(option);
                  return (
                    <Checkbox 
                      key={index} 
                      value={option} 
                      style={{ 
                        padding: '16px 20px', 
                        border: '1px solid #d9d9d9', 
                        borderRadius: '8px', 
                        width: '100%',
                        marginLeft: 0,
                        background: (answers[question.id] as string[] || []).includes(option) ? '#e6f7ff' : '#fff'
                      }}
                    >
                      <Space>
                        <span style={{ fontSize: '16px' }}>{option}</span>
                        {jumpInfo && (
                          <Tooltip title={jumpInfo.type === 'end' ? '选择后将结束答题' : `选择后将${jumpInfo.text.replace('→ ', '')}`}>
                            <Tag 
                              color={jumpInfo.type === 'end' ? 'red' : jumpInfo.type === 'jump' ? 'blue' : 'green'}
                              style={{ marginLeft: 8 }}
                            >
                              {jumpInfo.icon} {jumpInfo.text}
                            </Tag>
                          </Tooltip>
                        )}
                      </Space>
                    </Checkbox>
                  );
                })}
              </Space>
            </Checkbox.Group>
            {multiEndCheck.willEnd && (
              <Alert
                message="结束提示"
                description={`选择后将直接结束答题（共 ${(answers[question.id] as string[] || []).length} 个选项）`}
                type="warning"
                showIcon
                style={{ marginTop: 12 }}
              />
            )}
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
                <UploadOutlined style={{ fontSize: '24px' }} />
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

  // ========== 封面页 ==========
  if (showCover && survey) {
    const hasBg = !!survey.titleImageUrl;
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundImage: hasBg
            ? `url(${survey.titleImageUrl})`
            : 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          overflow: 'hidden',
        }}
      >
        {/* 半透明蒙层，增强文字可读性 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: hasBg
              ? 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 100%)'
              : 'rgba(0,0,0,0.15)',
          }}
        />
        {/* 浮层内容：标题 + 描述 + 按钮 */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            textAlign: 'center',
            padding: '32px 24px',
            maxWidth: 660,
            width: '90%',
          }}
        >
          {/* 标题浮层 */}
          <Title
            level={1}
            style={{
              color: '#fff',
              fontSize: 'clamp(30px, 5vw, 52px)',
              marginBottom: 24,
              textShadow: '0 2px 16px rgba(0,0,0,0.45)',
              lineHeight: 1.25,
              fontWeight: 700,
            }}
          >
            {survey.title}
          </Title>

          {/* 描述浮层 - 保留换行，左对齐 */}
          {survey.description && (
            <div
              style={{
                color: 'rgba(255,255,255,0.93)',
                fontSize: 18,
                marginBottom: 0,
                marginTop: 16,
                textShadow: '0 1px 8px rgba(0,0,0,0.4)',
                lineHeight: 1.75,
                textAlign: 'left',
                whiteSpace: 'pre-wrap',
                display: 'inline-block',
              }}
            >
              {survey.description}
            </div>
          )}

          {/* 题目数量提示 */}
          <div style={{ marginTop: 32, marginBottom: 48 }}>
            <Text
              style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: 15,
                letterSpacing: 1,
              }}
            >
              共 {visibleQuestionIndices.length > 0 ? visibleQuestionIndices.length : survey.questions.length} 道题目
            </Text>
          </div>

          {/* 开始答题按钮 */}
          <Button
            size="large"
            icon={<RightCircleOutlined />}
            onClick={() => setShowCover(false)}
            style={{
              height: 48,
              paddingLeft: 32,
              paddingRight: 32,
              fontSize: 16,
              borderRadius: 24,
              background: '#fff',
              color: '#1890ff',
              border: 'none',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              fontWeight: 600,
              letterSpacing: 1,
            }}
          >
            开始答题
          </Button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 12px' }}>
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <CheckCircleOutlined style={{ fontSize: '60px', color: '#52c41a', marginBottom: '16px' }} />
            <Title level={2}>提交成功</Title>
            <Paragraph style={{ fontSize: '16px' }}>
              感谢您的参与！您的答卷已成功提交。
            </Paragraph>
            <Button 
              type="primary" 
              size="large"
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

  // 确保questions存在且visibleQuestionIndices已计算完成
  if (!survey.questions || survey.questions.length === 0) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>问卷暂无问题</div>;
  }

  if (visibleQuestionIndices.length === 0) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>加载中...</div>;
  }

  const currentQuestionIndex = visibleQuestionIndices[currentStep];
  
  // 防御性检查：确保当前问题存在
  if (currentQuestionIndex === undefined || currentQuestionIndex < 0) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>加载中...</div>;
  }
  
  const currentQuestion = survey.questions[currentQuestionIndex];
  
  // 防御性检查：确保当前问题对象有效
  if (!currentQuestion) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>加载中...</div>;
  }
  
  const isLastQuestion = currentStep === visibleQuestionIndices.length - 1;

  // 获取当前问题所属的分区
  const currentSection = survey.sections?.find(s => s.id === currentQuestion?.sectionId);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflowY: 'auto',
        backgroundImage: survey.titleImageUrl ? `url(${survey.titleImageUrl})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* 暗纹蒙层 */}
      {survey.titleImageUrl && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        style={{ position: 'relative', zIndex: 1, maxWidth: 800, margin: '0 auto', padding: '24px 12px' }}
        onContextMenu={e => e.preventDefault()}
      >
        <style>{`
          .survey-protected .ant-typography,
          .survey-protected h1, .survey-protected h2,
          .survey-protected h3, .survey-protected h4,
          .survey-protected .question-text {
            user-select: none;
            -webkit-user-select: none;
            -webkit-touch-callout: none;
          }
          .survey-protected img {
            -webkit-user-drag: none;
            user-select: none;
            pointer-events: none;
          }
        `}</style>
      <Card style={{ boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)' }} className="survey-protected">
        {/* 问卷标题和进度 */}
        <div style={{ marginBottom: 24, textAlign: 'center', padding: '12px 0 0' }}>
          <Title level={3} style={{ marginBottom: 4 }}>{survey.title}</Title>
          {/* 进度条 */}
          <div style={{ marginTop: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Text type="secondary">答题进度</Text>
                <Text strong style={{ color: '#1890ff' }}>
                  {currentStep + 1} / {visibleQuestionIndices.length}
                </Text>
              </div>
              <Progress 
                percent={getProgress()} 
                strokeColor="#1890ff"
                strokeWidth={10}
                showInfo={false}
              />
            </Space>
          </div>
        </div>

        {/* 分区提示 */}
        {currentSection && (
          <Alert
            message={currentSection.title}
            description={currentSection.description}
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Alert
          message="填写提示"
          description="带 * 的问题为必填项，请完整填写后点击继续。"
          type="info"
          showIcon
          style={{ marginBottom: 32 }}
        />

        <Form
          form={form}
          layout="vertical"
          initialValues={answers}
          onFinish={() => {}}
        >
          <Card 
            className="survey-question"
            style={{ 
              marginBottom: 32, 
              border: '2px solid #1890ff',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div style={{ marginBottom: 20 }}>
              <Space>
                <Title level={3} style={{ margin: 0 }}>
                  问题 {currentStep + 1}
                </Title>
                <Tag color="blue" style={{ fontSize: '14px', padding: '4px 12px' }}>
                  {getQuestionTypeLabel(currentQuestion.type)}
                </Tag>
                {currentQuestion.required && <Tag color="red" style={{ fontSize: '14px', padding: '4px 12px' }}>必填</Tag>}
              </Space>
            </div>
            
            <Title level={4} style={{ marginBottom: 16 }} className="question-text">{currentQuestion.title}</Title>
            
            {currentQuestion.description && (
              <Paragraph type="secondary" style={{ fontSize: '16px', marginBottom: 20 }}>
                {currentQuestion.description}
              </Paragraph>
            )}

            {currentQuestion.imageUrl && (
              <div style={{ marginBottom: 24, textAlign: 'center' }}>
                <Text type="secondary">示例图片：</Text>
                <div style={{ marginTop: 12, position: 'relative', display: 'inline-block', maxWidth: 400 }}>
                  <Image
                    width="100%"
                    style={{ maxWidth: 400, borderRadius: '8px', pointerEvents: 'none', userSelect: 'none' }}
                    src={currentQuestion.imageUrl}
                    alt="示例图片"
                    preview={false}
                  />
                  {/* 图片水印 */}
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none',
                  }}>
                    <div style={{
                      color: 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 700,
                      letterSpacing: 2, textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                      transform: 'rotate(-15deg)', userSelect: 'none',
                    }}>仅限站内浏览</div>
                  </div>
                </div>
              </div>
            )}

            {renderQuestionInput(currentQuestion)}
          </Card>
        </Form>

        {/* 导航按钮 */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginTop: 24,
          gap: 16,
          flexWrap: 'wrap'
        }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={handlePrevious}
            disabled={currentStep === 0}
            size="large"
            style={{ flex: '1', minWidth: '100px' }}
          >
            上一题
          </Button>

          {isLastQuestion ? (
            <Button
              type="primary"
              size="large"
              icon={<CheckCircleOutlined />}
              onClick={handleSubmit}
              loading={loading}
              style={{ flex: '1', minHeight: '48px', fontSize: '16px', minWidth: '100px' }}
            >
              提交答卷
            </Button>
          ) : (
            <Button
              type="primary"
              size="large"
              icon={<ArrowRightOutlined />}
              onClick={handleNext}
              style={{ flex: '1', minHeight: '48px', fontSize: '16px', minWidth: '100px' }}
            >
              下一题
            </Button>
          )}
        </div>
      </Card>
      </div>
    </div>
  );
};

export default SurveyViewSequential;

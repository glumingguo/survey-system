import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Tag, 
  message, 
  Card, 
  Modal,
  Descriptions,
  Image,
  Typography,
  Empty,
  Divider
} from 'antd';
import { 
  EyeOutlined, 
  DeleteOutlined,
  FileTextOutlined,
  DownloadOutlined,
  InboxOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const { Title, Text, Paragraph } = Typography;

interface Response {
  id: string;
  surveyId: string;
  answers: { [key: string]: any };
  files: Array<{
    name: string;
    path: string;
    size: number;
    type: string;
  }>;
  submittedAt: string;
  ipAddress: string;
}

interface Question {
  id: string;
  title: string;
  type: string;
  options?: string[];
}

const ResponseList: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [loading, setLoading] = useState(false);
  const [responses, setResponses] = useState<Response[]>([]);
  const [survey, setSurvey] = useState<any>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<Response | null>(null);
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    if (id) {
      fetchResponses(id);
      fetchSurvey(id);
    }
  }, [id]);

  const fetchResponses = async (surveyId: string) => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/surveys/${surveyId}/responses`);
      setResponses(response.data);
    } catch (error) {
      message.error('获取答卷列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchSurvey = async (surveyId: string) => {
    try {
      const response = await axios.get(`/api/surveys/${surveyId}`);
      setSurvey(response.data);
    } catch (error) {
      message.error('获取问卷信息失败');
    }
  };

  const handleViewDetail = (response: Response) => {
    setSelectedResponse(response);
    setDetailModalVisible(true);
  };

  const handleDelete = async (responseId: string) => {
    try {
      await axios.delete(`/api/responses/${responseId}`);
      message.success('删除成功');
      if (id) {
        fetchResponses(id);
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleDownloadFile = (file: any) => {
    const link = document.createElement('a');
    link.href = file.path;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getAnswerText = (answer: any, question: Question) => {
    if (!answer) return '-';
    
    switch (question.type) {
      case 'singleChoice':
        return answer;
      case 'multipleChoice':
        return Array.isArray(answer) ? answer.join(', ') : answer;
      case 'text':
      case 'textarea':
        return (
          <Text ellipsis={{ tooltip: answer }} style={{ maxWidth: 300 }}>
            {answer}
          </Text>
        );
      case 'fileUpload':
        return `${Array.isArray(answer) ? answer.length : 0} 个文件`;
      default:
        return answer;
    }
  };

  const columns = [
    {
      title: '答卷ID',
      dataIndex: 'id',
      key: 'id',
      width: 120
    },
    {
      title: '提交时间',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      render: (date: string) => new Date(date).toLocaleString('zh-CN')
    },
    {
      title: 'IP地址',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 150
    },
    {
      title: '文件数量',
      dataIndex: 'files',
      key: 'files',
      render: (files: any[]) => <Text>{files.length} 个</Text>,
      width: 100
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: any, record: Response) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            查看
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2}>{survey?.title} - 答卷管理</Title>
        <Button onClick={() => navigate('/surveys')}>
          返回问卷列表
        </Button>
      </div>

      <Card>
        {responses.length === 0 ? (
          <Empty
            description="暂无答卷数据"
            image={<InboxOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={responses}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 份答卷`
            }}
          />
        )}
      </Card>

      {/* 答卷详情弹窗 */}
      <Modal
        title="答卷详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {selectedResponse && survey && (
          <div>
            <Descriptions bordered column={1}>
              <Descriptions.Item label="答卷ID">
                {selectedResponse.id}
              </Descriptions.Item>
              <Descriptions.Item label="提交时间">
                {new Date(selectedResponse.submittedAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="IP地址">
                {selectedResponse.ipAddress}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Title level={4}>回答内容</Title>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {survey.questions.map((question: Question) => {
                const answer = selectedResponse.answers[question.id];
                return (
                  <Card key={question.id} size="small">
                    <Text strong>{question.title}</Text>
                    <div style={{ marginTop: 8 }}>
                      {getAnswerText(answer, question)}
                    </div>
                  </Card>
                );
              })}
            </Space>

            {selectedResponse.files.length > 0 && (
              <>
                <Divider />
                <Title level={4}>上传的文件</Title>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {selectedResponse.files.map((file, index) => (
                    <Card key={index} size="small">
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Text strong>{file.name}</Text>
                        <Text type="secondary">
                          大小: {formatFileSize(file.size)} | 类型: {file.type}
                        </Text>
                        {file.type.startsWith('image/') && (
                          <Image
                            width={200}
                            src={file.path}
                            alt={file.name}
                            style={{ pointerEvents: 'none', userSelect: 'none' }}
                          />
                        )}
                        {isAdmin && (
                          <Button
                            type="link"
                            icon={<DownloadOutlined />}
                            onClick={() => handleDownloadFile(file)}
                          >
                            下载文件
                          </Button>
                        )}
                      </Space>
                    </Card>
                  ))}
                </Space>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ResponseList;

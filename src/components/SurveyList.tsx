import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Tag, 
  message, 
  Modal, 
  Card, 
  Input, 
  Typography,
  Popconfirm,
  Tooltip,
  Divider
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  QrcodeOutlined,
  BarChartOutlined,
  LinkOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import api from '../api/auth';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

interface Survey {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'published' | 'closed';
  createdAt: string;
  updatedAt: string;
  questionCount: number;
  responseCount: number;
  sequentialMode?: boolean;
}

const SurveyList: React.FC = () => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [shortLink, setShortLink] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchSurveys();
  }, []);

  const fetchSurveys = async () => {
    setLoading(true);
    try {
      // 获取我的问卷列表
      const response = await api.get('/api/surveys/my');
      const surveysWithCounts = await Promise.all(
        response.data.map(async (survey: any) => {
          const responseCount = await api.get(`/api/surveys/${survey.id}/responses`);
          return {
            ...survey,
            responseCount: responseCount.data.length,
            questionCount: survey.questions?.length || 0
          };
        })
      );
      setSurveys(surveysWithCounts);
    } catch (error) {
      message.error('获取问卷列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    navigate('/surveys/new');
  };

  const handleEdit = (id: string) => {
    navigate(`/surveys/${id}/edit`);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/surveys/${id}`);
      message.success('删除成功');
      fetchSurveys();
    } catch (error: any) {
      message.error(error.response?.data?.error || '删除失败');
    }
  };

  const handleShowQRCode = (survey: Survey) => {
    setSelectedSurvey(survey);
    setQrModalVisible(true);
  };

  const handleGenerateShortLink = async (survey: Survey) => {
    try {
      // 根据问卷模式选择正确的 URL
      const surveyUrl = survey.sequentialMode 
        ? `${window.location.origin}/survey/${survey.id}/sequential`
        : `${window.location.origin}/survey/${survey.id}`;
      
      const response = await api.post('/api/shortlink', {
        url: surveyUrl
      });
      setShortLink(response.data.shortUrl);
      setSelectedSurvey(survey);
      setLinkModalVisible(true);
    } catch (error) {
      message.error('生成短链接失败');
    }
  };

  const handleViewResponses = (id: string) => {
    navigate(`/surveys/${id}/responses`);
  };

  const handleViewStatistics = (id: string) => {
    navigate(`/surveys/${id}/statistics`);
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      draft: 'default',
      published: 'success',
      closed: 'error'
    };
    return colors[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const texts: any = {
      draft: '草稿',
      published: '已发布',
      closed: '已关闭'
    };
    return texts[status] || status;
  };

  const columns = [
    {
      title: '问卷标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: Survey) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {record.description}
          </Text>
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
      )
    },
    {
      title: '题目数量',
      dataIndex: 'questionCount',
      key: 'questionCount',
      render: (count: number) => <Text>{count} 题</Text>
    },
    {
      title: '答卷数量',
      dataIndex: 'responseCount',
      key: 'responseCount',
      render: (count: number) => <Text>{count} 份</Text>
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString('zh-CN')
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: Survey) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button 
              type="link" 
              icon={<EditOutlined />} 
              onClick={() => handleEdit(record.id)}
            />
          </Tooltip>
          <Tooltip title="查看答卷">
            <Button 
              type="link" 
              icon={<FileTextOutlined />} 
              onClick={() => handleViewResponses(record.id)}
            />
          </Tooltip>
          <Tooltip title="统计分析">
            <Button 
              type="link" 
              icon={<BarChartOutlined />} 
              onClick={() => handleViewStatistics(record.id)}
            />
          </Tooltip>
          <Tooltip title="二维码">
            <Button 
              type="link" 
              icon={<QrcodeOutlined />} 
              onClick={() => handleShowQRCode(record)}
            />
          </Tooltip>
          <Tooltip title="短链接">
            <Button 
              type="link" 
              icon={<LinkOutlined />} 
              onClick={() => handleGenerateShortLink(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个问卷吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button type="link" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2}>问卷管理</Title>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={handleCreate}
          size="large"
        >
          创建新问卷
        </Button>
      </div>
      
      <Card>
        <Table
          columns={columns}
          dataSource={surveys}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个问卷`
          }}
        />
      </Card>

      {/* 二维码弹窗 */}
      <Modal
        title={selectedSurvey?.title}
        open={qrModalVisible}
        onCancel={() => setQrModalVisible(false)}
        footer={null}
        width={400}
      >
        {selectedSurvey && (
          <div className="qr-code-container">
            <div style={{ marginBottom: 16, padding: '12px', background: '#f0f0f0', borderRadius: '8px' }}>
              <Space>
                <Tag color={selectedSurvey.sequentialMode ? 'blue' : 'green'}>
                  {selectedSurvey.sequentialMode ? '逐一显示模式' : '全部显示模式'}
                </Tag>
              </Space>
            </div>
            <img
              src={`/api/surveys/${selectedSurvey.id}/qrcode`}
              alt="问卷二维码"
              className="qr-code-image"
              style={{ width: 250, height: 250 }}
            />
            <p style={{ marginTop: 16 }}>
              扫描二维码或访问：<br />
              <a
                href={selectedSurvey.sequentialMode
                  ? `${window.location.origin}/survey/${selectedSurvey.id}/sequential`
                  : `${window.location.origin}/survey/${selectedSurvey.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {selectedSurvey.sequentialMode
                  ? `${window.location.origin}/survey/${selectedSurvey.id}/sequential`
                  : `${window.location.origin}/survey/${selectedSurvey.id}`}
              </a>
            </p>
          </div>
        )}
      </Modal>

      {/* 短链接弹窗 */}
      <Modal
        title={selectedSurvey?.title}
        open={linkModalVisible}
        onCancel={() => setLinkModalVisible(false)}
        footer={null}
        width={500}
      >
        {shortLink && (
          <div style={{ padding: '24px 0' }}>
            <Text>短链接：</Text>
            <div style={{ marginTop: 12 }}>
              <Input
                value={shortLink}
                readOnly
                addonAfter={
                  <Button 
                    type="link" 
                    size="small"
                    onClick={() => {
                      navigator.clipboard.writeText(shortLink);
                      message.success('已复制到剪贴板');
                    }}
                  >
                    复制
                  </Button>
                }
              />
            </div>
            <p style={{ marginTop: 16, color: '#999' }}>
              原链接：{`${window.location.origin}/survey/${selectedSurvey?.id}`}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SurveyList;

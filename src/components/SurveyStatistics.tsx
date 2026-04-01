import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Statistic, 
  Row, 
  Col, 
  Table, 
  message, 
  Spin, 
  Typography,
  Space,
  Divider,
  Button,
  Dropdown
} from 'antd';
import type { MenuProps } from 'antd';
import { 
  FileTextOutlined, 
  UserOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FilePdfOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const { Title, Text } = Typography;

interface StatisticsData {
  totalResponses: number;
  questions: QuestionStats[];
}

interface QuestionStats {
  id: string;
  title: string;
  type: string;
  optionCounts?: { [key: string]: number };
  percentage?: { [key: string]: string };
  answers?: string[];
}

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#fa8c16'];

const SurveyStatistics: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);
  const [surveyTitle, setSurveyTitle] = useState('');
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    if (id) {
      fetchStatistics(id);
    }
  }, [id]);

  // 导出数据
  const handleExport = async (type: 'excel' | 'csv' | 'pdf') => {
    if (!id) return;
    try {
      const response = await axios.get(`/api/surveys/${id}/export/${type}`, {
        responseType: 'blob'
      });
      
      // 创建下载链接
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${surveyTitle}_答卷数据.${type === 'excel' ? 'xlsx' : type}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };

  // 导出菜单
  const exportMenuItems: MenuProps['items'] = [
    {
      key: 'excel',
      icon: <FileExcelOutlined />,
      label: '导出 Excel',
      onClick: () => handleExport('excel')
    },
    {
      key: 'csv',
      icon: <FileTextOutlined />,
      label: '导出 CSV',
      onClick: () => handleExport('csv')
    },
    {
      key: 'pdf',
      icon: <FilePdfOutlined />,
      label: '导出 PDF',
      onClick: () => handleExport('pdf')
    }
  ];

  const fetchStatistics = async (surveyId: string) => {
    setLoading(true);
    try {
      // 获取问卷信息
      const surveyRes = await axios.get(`/api/surveys/${surveyId}`);
      setSurveyTitle(surveyRes.data.title);

      // 获取统计数据
      const statsRes = await axios.get(`/api/surveys/${surveyId}/statistics`);
      setStatistics(statsRes.data);
    } catch (error) {
      message.error('获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  const renderChoiceQuestion = (question: QuestionStats) => {
    const data = Object.entries(question.optionCounts || {}).map(([option, count]) => ({
      name: option,
      value: count as number,
      percentage: parseFloat(question.percentage?.[option] || '0')
    }));

    return (
      <div>
        <Title level={4}>{question.title}</Title>
        
        {/* 柱状图 */}
        {data.length > 0 && (
          <div style={{ height: 300, marginBottom: 24 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#1890ff" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 饼图 */}
        {data.length > 0 && (
          <div style={{ height: 300, marginBottom: 24 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 统计表格 */}
        <Table
          dataSource={data}
          pagination={false}
          rowKey="name"
          size="small"
          columns={[
            {
              title: '选项',
              dataIndex: 'name',
              key: 'name'
            },
            {
              title: '选择人数',
              dataIndex: 'value',
              key: 'value'
            },
            {
              title: '占比',
              dataIndex: 'percentage',
              key: 'percentage',
              render: (value) => `${value}%`
            }
          ]}
        />
      </div>
    );
  };

  const renderTextQuestion = (question: QuestionStats) => {
    return (
      <div>
        <Title level={4}>{question.title}</Title>
        {question.answers && question.answers.length > 0 ? (
          <Table
            dataSource={question.answers.map((answer, index) => ({
              key: index,
              answer
            }))}
            pagination={{ pageSize: 10 }}
            rowKey="key"
            columns={[
              {
                title: '回答',
                dataIndex: 'answer',
                key: 'answer',
                render: (text) => (
                  <Text ellipsis={{ tooltip: text }} style={{ maxWidth: 500 }}>
                    {text}
                  </Text>
                )
              }
            ]}
          />
        ) : (
          <Text type="secondary">暂无回答</Text>
        )}
      </div>
    );
  };

  const renderQuestion = (question: QuestionStats) => {
    if (question.type === 'singleChoice' || question.type === 'multipleChoice') {
      return renderChoiceQuestion(question);
    } else if (question.type === 'text' || question.type === 'textarea') {
      return renderTextQuestion(question);
    }
    return null;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!statistics) {
    return <div style={{ padding: '20px' }}>暂无数据</div>;
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2}>{surveyTitle} - 统计分析</Title>
        <Dropdown menu={{ items: exportMenuItems }} placement="bottomRight">
          <Button type="primary" icon={<DownloadOutlined />}>
            导出数据
          </Button>
        </Dropdown>
      </div>

      {/* 总览统计 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="总答卷数"
              value={statistics.totalResponses}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="问题数量"
              value={statistics.questions.length}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="数据更新"
              value="实时"
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 问题统计 */}
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {statistics.questions.map((question) => (
          <Card key={question.id} className="statistics-card">
            {renderQuestion(question)}
          </Card>
        ))}
      </Space>
    </div>
  );
};

export default SurveyStatistics;

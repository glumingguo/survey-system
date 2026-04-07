import React, { useEffect, useState } from 'react';
import {
  Card, Statistic, Row, Col, Table, Typography, Select, Spin, List, Tag
} from 'antd';
import { EyeOutlined, UserOutlined, CalendarOutlined } from '@ant-design/icons';
import { getVisitStats, type VisitStats } from '../api/site';

const { Title, Text } = Typography;
const { Option } = Select;

const VisitStatistics: React.FC = () => {
  const [stats, setStats] = useState<VisitStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  const loadStats = async (d: number) => {
    setLoading(true);
    try {
      const data = await getVisitStats(d);
      setStats(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStats(days); }, [days]);

  if (loading) return <Spin style={{ display: 'block', margin: '60px auto' }} />;
  if (!stats) return null;

  const dailyColumns = [
    { title: '日期', dataIndex: 'date', render: (d: string) => new Date(d).toLocaleDateString('zh-CN') },
    { title: '访问量', dataIndex: 'count', render: (c: string) => <strong>{c}</strong> }
  ];

  const activeUserColumns = [
    {
      title: '用户名',
      dataIndex: 'username',
      render: (name: string) => (
        <span><UserOutlined style={{ marginRight: 6 }} />{name}</span>
      )
    },
    { title: '访问次数', dataIndex: 'visit_count' },
    {
      title: '最近访问',
      dataIndex: 'last_visit',
      render: (t: string) => new Date(t).toLocaleString('zh-CN')
    }
  ];

  const recentColumns = [
    {
      title: '访客',
      render: (_: any, r: any) => r.username ? (
        <Tag color="blue">{r.username}</Tag>
      ) : (
        <Tag color="default">未登录</Tag>
      )
    },
    { title: '页面', dataIndex: 'path' },
    { title: 'IP', dataIndex: 'ip_address', render: (v: string) => v || '-' },
    {
      title: '时间',
      dataIndex: 'created_at',
      render: (t: string) => new Date(t).toLocaleString('zh-CN')
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>访客统计</Title>
        <Select value={days} onChange={setDays} style={{ width: 120 }}>
          <Option value={7}>近 7 天</Option>
          <Option value={14}>近 14 天</Option>
          <Option value={30}>近 30 天</Option>
        </Select>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="今日访问" value={stats.today} prefix={<CalendarOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="累计访问" value={stats.total} prefix={<EyeOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={`近${days}天访问`}
              value={stats.daily.reduce((sum, d) => sum + parseInt(d.count), 0)}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃用户数"
              value={stats.activeUsers.length}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card title={`近${days}天每日访问`}>
            <Table
              dataSource={stats.daily}
              columns={dailyColumns}
              rowKey="date"
              size="small"
              pagination={false}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="活跃用户排行">
            <Table
              dataSource={stats.activeUsers}
              columns={activeUserColumns}
              rowKey="username"
              size="small"
              pagination={false}
            />
          </Card>
        </Col>
      </Row>

      <Card title="最近访问记录">
        <Table
          dataSource={stats.recent}
          columns={recentColumns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </div>
  );
};

export default VisitStatistics;

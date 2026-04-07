import React, { useEffect, useState } from 'react';
import {
  Card, Table, Button, Input, Select, Tag, Space, Modal, Descriptions,
  Avatar, Typography, Row, Col, message, Drawer, Form, DatePicker, Tabs
} from 'antd';
import { SearchOutlined, ExportOutlined, EyeOutlined, UserOutlined, FilterOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../api/auth';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface UserRecord {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  avatar?: string;
  avatar_url?: string;
  nickname?: string;
  gender?: string;
  age?: number;
  birthday?: string;
  occupation?: string;
  marital_status?: string;
  province?: string;
  city?: string;
  phone?: string;
  wechat?: string;
  qq?: string;
  bio?: string;
  education?: string;
  income_range?: string;
  profile_completed?: boolean;
  created_at: string;
}

const MemberManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const formRef = React.useRef<any>(null);

  useEffect(() => {
    loadUsers();
  }, [page, pageSize, filters]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        page_size: String(pageSize),
        ...filters,
      };
      const response = await api.get('/api/admin/users', { params });
      setUsers(response.data.users || []);
      setTotal(response.data.total || 0);
    } catch (error: any) {
      message.error(error.response?.data?.error || '加载会员列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (values: any) => {
    setFilters(values);
    setPage(1);
    setFilterVisible(false);
  };

  const handleReset = () => {
    setFilters({});
    setPage(1);
    formRef.current?.resetFields();
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const params: Record<string, string> = { format, ...filters };
      const response = await api.get('/api/admin/users/export', { params });

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `members_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // CSV 已经由后端返回
        message.success('导出成功');
      }
    } catch (error: any) {
      message.error('导出失败');
    }
  };

  const viewDetail = async (user: UserRecord) => {
    setSelectedUser(user);
    setDetailVisible(true);
  };

  const getGenderLabel = (gender?: string) => {
    const map: Record<string, string> = { male: '男', female: '女', other: '保密' };
    return map[gender || ''] || '-';
  };

  const getMaritalLabel = (status?: string) => {
    const map: Record<string, string> = { single: '未婚', married: '已婚', divorced: '离异', widowed: '丧偶' };
    return map[status || ''] || '-';
  };

  const getEducationLabel = (edu?: string) => {
    const map: Record<string, string> = {
      junior: '初中及以下', high_school: '高中/中专', college: '大专',
      bachelor: '本科', master: '硕士', doctor: '博士'
    };
    return map[edu || ''] || '-';
  };

  const columns: ColumnsType<UserRecord> = [
    {
      title: '用户',
      key: 'user',
      render: (_, record) => (
        <Space>
          <Avatar
            src={record.avatar_url ? `${record.avatar_url}` : undefined}
            icon={<UserOutlined />}
            style={{ backgroundColor: '#1890ff' }}
          />
          <div>
            <div>{record.nickname || record.username}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: '性别',
      dataIndex: 'gender',
      key: 'gender',
      width: 80,
      render: (v) => getGenderLabel(v),
    },
    {
      title: '年龄',
      dataIndex: 'age',
      key: 'age',
      width: 60,
      render: (v) => v || '-',
    },
    {
      title: '地区',
      key: 'location',
      width: 120,
      render: (_, record) => {
        const loc = [record.province, record.city].filter(Boolean).join(' ');
        return loc || '-';
      },
    },
    {
      title: '职业',
      dataIndex: 'occupation',
      key: 'occupation',
      width: 100,
      render: (v) => v || '-',
    },
    {
      title: '婚姻',
      dataIndex: 'marital_status',
      key: 'marital_status',
      width: 80,
      render: (v) => getMaritalLabel(v),
    },
    {
      title: '学历',
      dataIndex: 'education',
      key: 'education',
      width: 80,
      render: (v) => getEducationLabel(v),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (v) => {
        const map: Record<string, { color: string; text: string }> = {
          active: { color: 'green', text: '正常' },
          pending: { color: 'orange', text: '待审核' },
          banned: { color: 'red', text: '已禁用' },
        };
        return <Tag color={map[v]?.color}>{map[v]?.text || v}</Tag>;
      },
    },
    {
      title: '资料',
      dataIndex: 'profile_completed',
      key: 'profile_completed',
      width: 80,
      render: (v) => (
        <Tag color={v ? 'green' : 'default'}>
          {v ? '已完善' : '未完善'}
        </Tag>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 100,
      render: (v) => new Date(v).toLocaleDateString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => viewDetail(record)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>会员管理</Title>
        <Space>
          <Button icon={<FilterOutlined />} onClick={() => setFilterVisible(true)}>
            筛选 ({Object.keys(filters).length})
          </Button>
          <Button icon={<ExportOutlined />} onClick={() => handleExport('csv')}>
            导出 CSV
          </Button>
          <Button icon={<ExportOutlined />} onClick={() => handleExport('json')}>
            导出 JSON
          </Button>
        </Space>
      </div>

      {/* 筛选条件展示 */}
      {Object.keys(filters).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Space wrap>
            {Object.entries(filters).map(([key, value]) => (
              <Tag
                key={key}
                closable
                onClose={() => {
                  const newFilters = { ...filters };
                  delete newFilters[key];
                  setFilters(newFilters);
                }}
              >
                {key}: {value}
              </Tag>
            ))}
            <Button type="link" size="small" onClick={handleReset}>
              清除全部
            </Button>
          </Space>
        </div>
      )}

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>

      {/* 筛选弹窗 */}
      <Modal
        title="筛选会员"
        open={filterVisible}
        onCancel={() => setFilterVisible(false)}
        footer={null}
        width={500}
      >
        <Form ref={formRef} layout="vertical" onFinish={handleSearch} initialValues={filters}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="状态" name="status">
                <Select placeholder="选择状态" allowClear>
                  <Option value="active">正常</Option>
                  <Option value="pending">待审核</Option>
                  <Option value="banned">已禁用</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="性别" name="gender">
                <Select placeholder="选择性别" allowClear>
                  <Option value="male">男</Option>
                  <Option value="female">女</Option>
                  <Option value="other">保密</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="婚姻状况" name="marital_status">
                <Select placeholder="选择婚姻状况" allowClear>
                  <Option value="single">未婚</Option>
                  <Option value="married">已婚</Option>
                  <Option value="divorced">离异</Option>
                  <Option value="widowed">丧偶</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="学历" name="education">
                <Select placeholder="选择学历" allowClear>
                  <Option value="junior">初中及以下</Option>
                  <Option value="high_school">高中/中专</Option>
                  <Option value="college">大专</Option>
                  <Option value="bachelor">本科</Option>
                  <Option value="master">硕士</Option>
                  <Option value="doctor">博士</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="收入范围" name="income_range">
                <Select placeholder="选择收入" allowClear>
                  <Option value="0-5000">5000以下</Option>
                  <Option value="5000-10000">5000-10000</Option>
                  <Option value="10000-20000">10000-20000</Option>
                  <Option value="20000-50000">20000-50000</Option>
                  <Option value="50000+">50000以上</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="资料完善" name="profile_completed">
                <Select placeholder="选择" allowClear>
                  <Option value="true">已完善</Option>
                  <Option value="false">未完善</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="搜索" name="search">
                <Input placeholder="搜索用户名、邮箱、昵称、电话" />
              </Form.Item>
            </Col>
          </Row>
          <Space>
            <Button type="primary" htmlType="submit">应用筛选</Button>
            <Button onClick={handleReset}>重置</Button>
          </Space>
        </Form>
      </Modal>

      {/* 会员详情抽屉 */}
      <Drawer
        title="会员详情"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        width={600}
      >
        {selectedUser && (
          <Tabs
            items={[
              {
                key: 'basic',
                label: '基本信息',
                children: (
                  <Descriptions column={2} bordered size="small">
                    <Descriptions.Item label="用户名">{selectedUser.username}</Descriptions.Item>
                    <Descriptions.Item label="邮箱">{selectedUser.email}</Descriptions.Item>
                    <Descriptions.Item label="昵称">{selectedUser.nickname || '-'}</Descriptions.Item>
                    <Descriptions.Item label="性别">{getGenderLabel(selectedUser.gender)}</Descriptions.Item>
                    <Descriptions.Item label="年龄">{selectedUser.age || '-'}</Descriptions.Item>
                    <Descriptions.Item label="生日">{selectedUser.birthday || '-'}</Descriptions.Item>
                    <Descriptions.Item label="职业">{selectedUser.occupation || '-'}</Descriptions.Item>
                    <Descriptions.Item label="婚姻状况">{getMaritalLabel(selectedUser.marital_status)}</Descriptions.Item>
                    <Descriptions.Item label="学历">{getEducationLabel(selectedUser.education)}</Descriptions.Item>
                    <Descriptions.Item label="收入">{selectedUser.income_range || '-'}</Descriptions.Item>
                    <Descriptions.Item label="账号状态">
                      <Tag color={selectedUser.status === 'active' ? 'green' : selectedUser.status === 'pending' ? 'orange' : 'red'}>
                        {selectedUser.status === 'active' ? '正常' : selectedUser.status === 'pending' ? '待审核' : '已禁用'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="资料完善">
                      <Tag color={selectedUser.profile_completed ? 'green' : 'default'}>
                        {selectedUser.profile_completed ? '已完善' : '未完善'}
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="注册时间" span={2}>
                      {new Date(selectedUser.created_at).toLocaleString('zh-CN')}
                    </Descriptions.Item>
                  </Descriptions>
                ),
              },
              {
                key: 'contact',
                label: '联系方式',
                children: (
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="所在地区">
                      {[selectedUser.province, selectedUser.city, selectedUser.district].filter(Boolean).join(' ') || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="详细地址">{selectedUser.address || '-'}</Descriptions.Item>
                    <Descriptions.Item label="联系电话">{selectedUser.phone || '-'}</Descriptions.Item>
                    <Descriptions.Item label="微信号">{selectedUser.wechat || '-'}</Descriptions.Item>
                    <Descriptions.Item label="QQ号">{selectedUser.qq || '-'}</Descriptions.Item>
                  </Descriptions>
                ),
              },
              {
                key: 'bio',
                label: '个人简介',
                children: (
                  <div style={{ padding: 8 }}>
                    <Text>{selectedUser.bio || '暂无简介'}</Text>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Drawer>
    </div>
  );
};

export default MemberManagement;

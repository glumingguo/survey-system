import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Input, Select, Tag, Space, Modal, Descriptions,
  Avatar, Typography, Row, Col, message, Drawer, Form, Tabs, Badge,
  Popconfirm, Tooltip, Statistic, Progress, List, Checkbox
} from 'antd';
import {
  SearchOutlined, ExportOutlined, EyeOutlined, UserOutlined, FilterOutlined,
  CheckOutlined, StopOutlined, DeleteOutlined, TeamOutlined, PlusOutlined,
  EditOutlined, LockOutlined, UnlockOutlined, ClockCircleOutlined, RiseOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import api from '../api/auth';

const { Title, Text } = Typography;
const { Option } = Select;

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
  last_login?: string;
  login_count?: number;
  group_ids?: string[];
}

interface UserGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  permissions?: string[];
  created_at: string;
}

interface BlacklistItem {
  id: string;
  type: 'email' | 'ip' | 'username';
  value: string;
  reason?: string;
  created_at: string;
}

const MemberManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [blacklist, setBlacklist] = useState<BlacklistItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [searchText, setSearchText] = useState('');
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<UserGroup | null>(null);
  const [blacklistModalVisible, setBlacklistModalVisible] = useState(false);
  const [blacklistForm] = Form.useForm();
  const [assignGroupUserId, setAssignGroupUserId] = useState<string | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const formRef = React.useRef<any>(null);
  const groupFormRef = React.useRef<any>(null);

  useEffect(() => {
    loadUsers();
    loadGroups();
    loadBlacklist();
  }, [page, pageSize, filters]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        page: String(page),
        page_size: String(pageSize),
        ...filters,
      };
      if (searchText) {
        params.search = searchText;
      }
      const response = await api.get('/api/admin/users', { params });
      setUsers(response.data.users || []);
      setTotal(response.data.total || 0);
    } catch (error: any) {
      message.error(error.response?.data?.error || '加载会员列表失败');
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const response = await api.get('/api/admin/groups');
      setGroups(response.data);
    } catch {
      // 分组功能可能未启用
    }
  };

  const loadBlacklist = async () => {
    try {
      const response = await api.get('/api/admin/blacklist');
      setBlacklist(response.data);
    } catch {
      // 黑名单功能可能未启用
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

  const handleSearchText = (value: string) => {
    setSearchText(value);
    setPage(1);
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const params: Record<string, string> = { format, ...filters };
      if (searchText) params.search = searchText;
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
        message.success('导出成功');
      }
    } catch {
      message.error('导出失败');
    }
  };

  // 批量操作
  const handleBatchAction = async (action: string) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择用户');
      return;
    }

    try {
      if (action === 'approve') {
        await api.post('/api/admin/users/batch-approve', { user_ids: selectedRowKeys });
        message.success(`已通过 ${selectedRowKeys.length} 个用户的审核`);
      } else if (action === 'disable') {
        await api.post('/api/admin/users/batch-disable', { user_ids: selectedRowKeys });
        message.success(`已禁用 ${selectedRowKeys.length} 个用户`);
      } else if (action === 'delete') {
        await api.post('/api/admin/users/batch-delete', { user_ids: selectedRowKeys });
        message.success(`已删除 ${selectedRowKeys.length} 个用户`);
      }
      setSelectedRowKeys([]);
      loadUsers();
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  // 用户状态操作
  const handleStatusChange = async (userId: string, status: string) => {
    try {
      await api.put(`/api/admin/users/${userId}/status`, { status });
      message.success('状态已更新');
      loadUsers();
    } catch {
      message.error('更新失败');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await api.delete(`/api/admin/users/${userId}`);
      message.success('用户已删除');
      loadUsers();
    } catch (error: any) {
      message.error(error.response?.data?.error || '删除失败');
    }
  };

  // 分组操作
  const handleGroupSubmit = async (values: any) => {
    try {
      if (editingGroup) {
        await api.put(`/api/admin/groups/${editingGroup.id}`, values);
        message.success('分组已更新');
      } else {
        await api.post('/api/admin/groups', values);
        message.success('分组已创建');
      }
      setGroupModalVisible(false);
      groupFormRef.current?.resetFields();
      setEditingGroup(null);
      loadGroups();
    } catch {
      message.error('操作失败');
    }
  };

  const handleDeleteGroup = async (id: string) => {
    try {
      await api.delete(`/api/admin/groups/${id}`);
      message.success('分组已删除');
      loadGroups();
    } catch {
      message.error('删除失败');
    }
  };

  // 分配分组
  const openAssignGroups = (user: UserRecord) => {
    setAssignGroupUserId(user.id);
    setSelectedGroupIds(user.group_ids || []);
  };

  const handleAssignGroups = async () => {
    if (!assignGroupUserId) return;
    try {
      await api.put(`/api/admin/users/${assignGroupUserId}/groups`, { group_ids: selectedGroupIds });
      message.success('分组已更新');
      setAssignGroupUserId(null);
      loadUsers();
    } catch {
      message.error('更新失败');
    }
  };

  // 黑名单操作
  const handleAddBlacklist = async (values: any) => {
    try {
      await api.post('/api/admin/blacklist', values);
      message.success('已加入黑名单');
      blacklistForm.resetFields();
      setBlacklistModalVisible(false);
      loadBlacklist();
    } catch {
      message.error('添加失败');
    }
  };

  const handleRemoveBlacklist = async (id: string) => {
    try {
      await api.delete(`/api/admin/blacklist/${id}`);
      message.success('已从黑名单移除');
      loadBlacklist();
    } catch {
      message.error('移除失败');
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

  // 统计数据
  const stats = {
    total: users.length,
    active: users.filter(u => u.status === 'active').length,
    pending: users.filter(u => u.status === 'pending').length,
    banned: users.filter(u => u.status === 'banned').length,
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
            style={{ backgroundColor: record.role === 'admin' ? '#f50' : '#1890ff' }}
          />
          <div>
            <div>
              {record.nickname || record.username}
              {record.role === 'admin' && <Tag color="red" style={{ marginLeft: 4 }}>管理员</Tag>}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>{record.email}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: '分组',
      key: 'groups',
      width: 150,
      render: (_, record) => (
        <Space wrap size={4}>
          {(record.group_ids || []).map(gid => {
            const g = groups.find(g => g.id === gid);
            return g ? <Tag key={gid} color={g.color}>{g.name}</Tag> : null;
          })}
          {(!record.group_ids || record.group_ids.length === 0) && <Text type="secondary">-</Text>}
        </Space>
      ),
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
      title: '活跃度',
      key: 'activity',
      width: 100,
      render: (_, record) => {
        const loginCount = record.login_count || 0;
        if (loginCount === 0) return <Text type="secondary">从未登录</Text>;
        if (loginCount < 5) return <Text type="secondary">活跃度低</Text>;
        if (loginCount < 20) return <Text type="processing">活跃</Text>;
        return <Text type="success"><RiseOutlined /> 高度活跃</Text>;
      },
    },
    {
      title: '最近登录',
      dataIndex: 'last_login',
      key: 'last_login',
      width: 100,
      render: (v) => {
        if (!v) return <Text type="secondary">-</Text>;
        const days = Math.floor((Date.now() - new Date(v).getTime()) / (1000 * 60 * 60 * 24));
        if (days === 0) return <Tag color="green">今天</Tag>;
        if (days === 1) return <Tag color="blue">昨天</Tag>;
        if (days < 7) return <Tag color="orange">{days}天前</Tag>;
        return <Text type="secondary">{new Date(v).toLocaleDateString('zh-CN')}</Text>;
      },
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
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="分配分组">
            <Button size="small" icon={<TeamOutlined />} onClick={() => openAssignGroups(record)} />
          </Tooltip>
          <Tooltip title="查看详情">
            <Button size="small" icon={<EyeOutlined />} onClick={() => viewDetail(record)} />
          </Tooltip>
          {record.status === 'pending' && (
            <Tooltip title="通过审核">
              <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleStatusChange(record.id, 'active')} />
            </Tooltip>
          )}
          {record.status === 'active' && record.role !== 'admin' && (
            <Tooltip title="禁用账号">
              <Button size="small" danger icon={<StopOutlined />} onClick={() => handleStatusChange(record.id, 'banned')} />
            </Tooltip>
          )}
          {record.status === 'banned' && (
            <Tooltip title="恢复账号">
              <Button size="small" icon={<CheckOutlined />} onClick={() => handleStatusChange(record.id, 'active')} />
            </Tooltip>
          )}
          {record.role !== 'admin' && (
            <Popconfirm title="确认删除此用户？" onConfirm={() => handleDeleteUser(record.id)} okText="删除" cancelText="取消" okType="danger">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const groupColumns: ColumnsType<UserGroup> = [
    {
      title: '分组名称',
      dataIndex: 'name',
      render: (name: string, record: UserGroup) => (
        <Tag color={record.color} style={{ fontSize: 14, padding: '4px 12px' }}>{name}</Tag>
      )
    },
    { title: '描述', dataIndex: 'description', render: (v: string) => v || '-' },
    { title: '权限', dataIndex: 'permissions', render: (p: string[]) => p?.length || 0 },
    {
      title: '成员数',
      render: (_, record: UserGroup) => users.filter(u => u.group_ids?.includes(record.id)).length
    },
    {
      title: '操作',
      render: (_: any, record: UserGroup) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => {
            setEditingGroup(record);
            groupFormRef.current?.setFieldsValue(record);
            setGroupModalVisible(true);
          }} />
          <Popconfirm title="确认删除此分组？" onConfirm={() => handleDeleteGroup(record.id)} okText="删除" cancelText="取消" okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const blacklistColumns: ColumnsType<BlacklistItem> = [
    {
      title: '类型',
      dataIndex: 'type',
      render: (v: string) => {
        const map: Record<string, { color: string; text: string }> = {
          email: { color: 'purple', text: '邮箱' },
          ip: { color: 'cyan', text: 'IP' },
          username: { color: 'orange', text: '用户名' },
        };
        return <Tag color={map[v]?.color}>{map[v]?.text || v}</Tag>;
      }
    },
    { title: '值', dataIndex: 'value' },
    { title: '原因', dataIndex: 'reason', render: (v: string) => v || '-' },
    { title: '添加时间', dataIndex: 'created_at', render: (v: string) => new Date(v).toLocaleDateString('zh-CN') },
    {
      title: '操作',
      render: (_: any, record: BlacklistItem) => (
        <Popconfirm title="确认移除？" onConfirm={() => handleRemoveBlacklist(record.id)} okText="移除" cancelText="取消">
          <Button size="small" type="link" danger>移除</Button>
        </Popconfirm>
      )
    }
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  };

  const pendingCount = users.filter(u => u.status === 'pending').length;

  return (
    <div>
      <Tabs
        items={[
          {
            key: 'users',
            label: (
              <span>
                会员列表
                {pendingCount > 0 && <Badge count={pendingCount} style={{ marginLeft: 8 }} />}
              </span>
            ),
            children: (
              <>
                {/* 统计卡片 */}
                <Row gutter={16} style={{ marginBottom: 16 }}>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic title="总会员数" value={total} prefix={<UserOutlined />} />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic title="正常" value={stats.active} valueStyle={{ color: '#52c41a' }} />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic title="待审核" value={stats.pending} valueStyle={{ color: '#faad14' }} />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card size="small">
                      <Statistic title="已禁用" value={stats.banned} valueStyle={{ color: '#ff4d4f' }} />
                    </Card>
                  </Col>
                </Row>

                {/* 操作栏 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <Space>
                    <Input.Search placeholder="搜索用户名/邮箱/昵称" onSearch={handleSearchText} style={{ width: 240 }} allowClear />
                    <Button icon={<FilterOutlined />} onClick={() => setFilterVisible(true)}>
                      筛选 {Object.keys(filters).length > 0 && `(${Object.keys(filters).length})`}
                    </Button>
                  </Space>
                  <Space>
                    <Button icon={<ExportOutlined />} onClick={() => handleExport('csv')}>导出 CSV</Button>
                    <Button icon={<ExportOutlined />} onClick={() => handleExport('json')}>导出 JSON</Button>
                  </Space>
                </div>

                {/* 批量操作 */}
                {selectedRowKeys.length > 0 && (
                  <Card size="small" style={{ marginBottom: 16, background: '#f6ffed' }}>
                    <Space>
                      <Text strong>已选择 {selectedRowKeys.length} 个用户：</Text>
                      <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleBatchAction('approve')}>批量通过</Button>
                      <Button size="small" danger icon={<StopOutlined />} onClick={() => handleBatchAction('disable')}>批量禁用</Button>
                      <Popconfirm title={`确认删除选中的 ${selectedRowKeys.length} 个用户？`} onConfirm={() => handleBatchAction('delete')} okText="删除" cancelText="取消" okType="danger">
                        <Button size="small" danger icon={<DeleteOutlined />}>批量删除</Button>
                      </Popconfirm>
                      <Button size="small" onClick={() => setSelectedRowKeys([])}>取消选择</Button>
                    </Space>
                  </Card>
                )}

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
                      <Button type="link" size="small" onClick={handleReset}>清除全部</Button>
                    </Space>
                  </div>
                )}

                <Card styles={{ body: { padding: 0 } }}>
                  <Table
                    columns={columns}
                    dataSource={users}
                    rowKey="id"
                    loading={loading}
                    scroll={{ x: 1400 }}
                    rowSelection={rowSelection}
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
              </>
            )
          },
          {
            key: 'groups',
            label: '用户分组',
            children: (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingGroup(null); groupFormRef.current?.resetFields(); setGroupModalVisible(true); }}>
                    新建分组
                  </Button>
                </div>
                <Card styles={{ body: { padding: 0 } }}>
                  <Table
                    dataSource={groups}
                    columns={groupColumns}
                    rowKey="id"
                    pagination={false}
                  />
                </Card>
              </div>
            )
          },
          {
            key: 'blacklist',
            label: '黑名单管理',
            children: (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <Button type="primary" icon={<LockOutlined />} onClick={() => setBlacklistModalVisible(true)}>
                    添加到黑名单
                  </Button>
                </div>
                <Card styles={{ body: { padding: 0 } }}>
                  <Table
                    dataSource={blacklist}
                    columns={blacklistColumns}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                    locale={{ emptyText: '暂无黑名单记录' }}
                  />
                </Card>
              </div>
            )
          },
          {
            key: 'stats',
            label: '活跃度统计',
            children: (
              <div>
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={8}>
                    <Card title="用户活跃度分布">
                      <div style={{ textAlign: 'center' }}>
                        <Progress
                          type="circle"
                          percent={Math.round((users.filter(u => (u.login_count || 0) > 10).length / Math.max(users.length, 1)) * 100)}
                          strokeColor="#52c41a"
                        />
                        <div style={{ marginTop: 8 }}>
                          <Text type="secondary">高度活跃用户</Text>
                        </div>
                      </div>
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card title="登录趋势">
                      <Statistic
                        title="平均登录次数"
                        value={Math.round(users.reduce((sum, u) => sum + (u.login_count || 0), 0) / Math.max(users.length, 1))}
                        suffix="次"
                        prefix={<ClockCircleOutlined />}
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card title="活跃用户 TOP 5">
                      <List
                        size="small"
                        dataSource={users.sort((a, b) => (b.login_count || 0) - (a.login_count || 0)).slice(0, 5)}
                        renderItem={(item) => (
                          <List.Item>
                            <List.Item.Meta
                              avatar={<Avatar icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />}
                              title={item.nickname || item.username}
                              description={`登录 ${item.login_count || 0} 次`}
                            />
                          </List.Item>
                        )}
                      />
                    </Card>
                  </Col>
                </Row>
                <Card title="最近活跃用户">
                  <Table
                    dataSource={users.filter(u => u.last_login).sort((a, b) => new Date(b.last_login!).getTime() - new Date(a.last_login!).getTime()).slice(0, 10)}
                    columns={[
                      { title: '用户', dataIndex: 'username', render: (v, r) => <Space><Avatar size="small" icon={<UserOutlined />} />{r.nickname || v}</Space> },
                      { title: '最后登录', dataIndex: 'last_login', render: (v) => new Date(v).toLocaleString('zh-CN') },
                      { title: '登录次数', dataIndex: 'login_count' },
                      { title: '注册时间', dataIndex: 'created_at', render: (v) => new Date(v).toLocaleDateString('zh-CN') },
                    ]}
                    rowKey="id"
                    pagination={false}
                    size="small"
                  />
                </Card>
              </div>
            )
          }
        ]}
      />

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

      {/* 新建/编辑分组弹窗 */}
      <Modal
        title={editingGroup ? '编辑分组' : '新建分组'}
        open={groupModalVisible}
        onOk={() => groupFormRef.current?.submit()}
        onCancel={() => { setGroupModalVisible(false); setEditingGroup(null); groupFormRef.current?.resetFields(); }}
        okText="保存"
        cancelText="取消"
      >
        <Form
          ref={groupFormRef}
          layout="vertical"
          onFinish={handleGroupSubmit}
          initialValues={editingGroup || {}}
        >
          <Form.Item label="分组名称" name="name" rules={[{ required: true, message: '请输入分组名称' }]}>
            <Input placeholder="例如：VIP会员" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input placeholder="分组说明（可选）" />
          </Form.Item>
          <Form.Item label="标签颜色" name="color" initialValue="#1890ff">
            <Select>
              {['#f50', '#2db7f5', '#87d068', '#108ee9', '#722ed1', '#eb2f96', '#fa8c16', '#52c41a'].map(c => (
                <Option key={c} value={c}>
                  <Tag color={c}>{c}</Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 添加黑名单弹窗 */}
      <Modal
        title="添加到黑名单"
        open={blacklistModalVisible}
        onOk={() => blacklistForm.submit()}
        onCancel={() => { setBlacklistModalVisible(false); blacklistForm.resetFields(); }}
        okText="添加"
        cancelText="取消"
      >
        <Form
          form={blacklistForm}
          layout="vertical"
          onFinish={handleAddBlacklist}
        >
          <Form.Item label="类型" name="type" rules={[{ required: true, message: '请选择类型' }]}>
            <Select placeholder="选择类型">
              <Option value="email">邮箱</Option>
              <Option value="ip">IP 地址</Option>
              <Option value="username">用户名</Option>
            </Select>
          </Form.Item>
          <Form.Item label="值" name="value" rules={[{ required: true, message: '请输入值' }]}>
            <Input placeholder="输入邮箱/IP/用户名" />
          </Form.Item>
          <Form.Item label="原因" name="reason">
            <Input.TextArea placeholder="添加原因（可选）" rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 分配分组弹窗 */}
      <Modal
        title="分配用户分组"
        open={!!assignGroupUserId}
        onOk={handleAssignGroups}
        onCancel={() => setAssignGroupUserId(null)}
        okText="保存"
        cancelText="取消"
      >
        <p>选择该用户所属的分组（可多选）：</p>
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="选择分组"
          value={selectedGroupIds}
          onChange={setSelectedGroupIds}
        >
          {groups.map(g => (
            <Option key={g.id} value={g.id}>
              <Tag color={g.color}>{g.name}</Tag>
            </Option>
          ))}
        </Select>
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
                    <Descriptions.Item label="登录次数">
                      {selectedUser.login_count || 0} 次
                    </Descriptions.Item>
                    <Descriptions.Item label="最近登录">
                      {selectedUser.last_login ? new Date(selectedUser.last_login).toLocaleString('zh-CN') : '从未登录'}
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

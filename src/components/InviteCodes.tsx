import React, { useEffect, useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Space, Popconfirm,
  message, Typography, Tag, DatePicker, InputNumber, Switch, Tooltip
} from 'antd';
import { PlusOutlined, DeleteOutlined, CopyOutlined, StopOutlined, CheckOutlined } from '@ant-design/icons';
import { getInviteCodes, createInviteCode, toggleInviteCode, deleteInviteCode, type InviteCode } from '../api/site';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const InviteCodes: React.FC = () => {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const loadCodes = async () => {
    setLoading(true);
    try {
      const data = await getInviteCodes();
      setCodes(data);
    } catch {
      message.error('加载邀请码失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCodes(); }, []);

  const handleCreate = async (values: any) => {
    try {
      await createInviteCode({
        note: values.note,
        maxUses: values.maxUses || 1,
        expiresAt: values.expiresAt ? values.expiresAt.toISOString() : undefined
      });
      message.success('邀请码已生成');
      setCreateOpen(false);
      form.resetFields();
      loadCodes();
    } catch {
      message.error('创建失败');
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      await toggleInviteCode(id, !current);
      message.success(current ? '已停用' : '已启用');
      loadCodes();
    } catch {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteInviteCode(id);
      message.success('已删除');
      loadCodes();
    } catch {
      message.error('删除失败');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => message.success('已复制到剪贴板'));
  };

  const columns = [
    {
      title: '邀请码',
      dataIndex: 'code',
      render: (code: string) => (
        <Space>
          <Text code style={{ fontSize: 15, letterSpacing: 2 }}>{code}</Text>
          <Tooltip title="复制">
            <Button size="small" icon={<CopyOutlined />} onClick={() => copyCode(code)} />
          </Tooltip>
        </Space>
      )
    },
    { title: '备注', dataIndex: 'note', render: (v: string) => v || '-' },
    {
      title: '使用情况',
      render: (_: any, r: InviteCode) => (
        <span>{r.used_count} / {r.max_uses}</span>
      )
    },
    {
      title: '状态',
      render: (_: any, r: InviteCode) => {
        if (!r.is_active) return <Tag color="red">已停用</Tag>;
        if (r.expires_at && new Date(r.expires_at) < new Date()) return <Tag color="orange">已过期</Tag>;
        if (r.used_count >= r.max_uses) return <Tag color="gray">已用完</Tag>;
        return <Tag color="green">可用</Tag>;
      }
    },
    {
      title: '过期时间',
      dataIndex: 'expires_at',
      render: (v: string) => v ? new Date(v).toLocaleDateString('zh-CN') : '永久有效'
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      render: (v: string) => new Date(v).toLocaleDateString('zh-CN')
    },
    {
      title: '操作',
      render: (_: any, r: InviteCode) => (
        <Space>
          <Tooltip title={r.is_active ? '停用' : '启用'}>
            <Button
              size="small"
              icon={r.is_active ? <StopOutlined /> : <CheckOutlined />}
              onClick={() => handleToggle(r.id, r.is_active)}
            />
          </Tooltip>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)} okText="删除" cancelText="取消" okType="danger">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>邀请码管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          生成邀请码
        </Button>
      </div>

      <Table
        dataSource={codes}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title="生成邀请码"
        open={createOpen}
        onOk={() => form.submit()}
        onCancel={() => { setCreateOpen(false); form.resetFields(); }}
        okText="生成"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="备注" name="note">
            <Input placeholder="例如：发给 XXX（可选）" />
          </Form.Item>
          <Form.Item label="最多使用次数" name="maxUses" initialValue={1}>
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="过期时间" name="expiresAt">
            <DatePicker
              style={{ width: '100%' }}
              placeholder="不填则永久有效"
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InviteCodes;

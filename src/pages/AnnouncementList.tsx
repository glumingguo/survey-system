import React, { useEffect, useState } from 'react';
import {
  Card, Button, Modal, Form, Input, Select, Switch, Tag, Space,
  Popconfirm, message, Typography, List, Row, Col
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PushpinOutlined } from '@ant-design/icons';
import {
  getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  getGroups, type Announcement, type UserGroup
} from '../api/site';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const AnnouncementList: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [annData, groupData] = await Promise.all([
        getAnnouncements(),
        isAdmin ? getGroups() : Promise.resolve([])
      ]);
      setAnnouncements(annData);
      setGroups(groupData);
    } catch {
      message.error('加载公告失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [isAdmin]);

  const handleSubmit = async (values: any) => {
    try {
      if (editing) {
        await updateAnnouncement(editing.id, {
          ...values,
          targetType: values.targetType,
          targetGroupIds: values.targetGroupIds || [],
          isPinned: values.isPinned || false
        });
        message.success('公告已更新');
      } else {
        await createAnnouncement({
          ...values,
          targetType: values.targetType || 'all',
          targetGroupIds: values.targetGroupIds || [],
          isPinned: values.isPinned || false
        });
        message.success('公告已发布');
      }
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      loadData();
    } catch {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAnnouncement(id);
      message.success('公告已删除');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const openEdit = (ann: Announcement) => {
    setEditing(ann);
    form.setFieldsValue({
      title: ann.title,
      content: ann.content,
      targetType: ann.target_type,
      targetGroupIds: ann.target_group_ids || [],
      isPinned: ann.is_pinned,
    });
    setModalOpen(true);
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      {/* 页面标题和发布按钮 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>公告通知</Title>
        {isAdmin && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}
          >
            发布公告
          </Button>
        )}
      </div>

      {/* 公告列表 */}
      <List
        loading={loading}
        dataSource={announcements}
        locale={{ emptyText: '暂无公告' }}
        renderItem={(ann) => (
          <Card
            style={{ marginBottom: 16 }}
            extra={
              isAdmin && (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(ann)} />
                  <Popconfirm title="确认删除？" onConfirm={() => handleDelete(ann.id)} okText="删除" okType="danger" cancelText="取消">
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              )
            }
            title={
              <Space>
                {ann.is_pinned && <Tag icon={<PushpinOutlined />} color="red">置顶</Tag>}
                <span>{ann.title}</span>
              </Space>
            }
          >
            <div style={{ whiteSpace: 'pre-wrap', color: '#333', marginBottom: 12 }}>{ann.content}</div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {new Date(ann.created_at).toLocaleString('zh-CN')}
              </Text>
              {isAdmin && (
                <span style={{ marginLeft: 12 }}>
                  {ann.target_type === 'all' && <Tag>所有人</Tag>}
                  {ann.target_type === 'members' && <Tag color="blue">仅会员</Tag>}
                  {ann.target_type === 'groups' && (
                    <Space>
                      {(ann.target_group_ids || []).map(gid => {
                        const g = groups.find(g => g.id === gid);
                        return g ? <Tag key={gid} color={g.color}>{g.name}</Tag> : null;
                      })}
                    </Space>
                  )}
                </span>
              )}
            </div>
          </Card>
        )}
      />

      {/* 发布/编辑公告弹窗 */}
      <Modal
        title={editing ? '编辑公告' : '发布公告'}
        open={modalOpen}
        onOk={() => form.submit()}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        okText={editing ? '保存' : '发布'}
        cancelText="取消"
        width={560}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="公告标题" />
          </Form.Item>
          <Form.Item label="内容" name="content" rules={[{ required: true, message: '请输入内容' }]}>
            <TextArea rows={5} placeholder="公告内容" />
          </Form.Item>
          <Form.Item label="可见范围" name="targetType" initialValue="all">
            <Select>
              <Option value="all">所有访客（包括未登录）</Option>
              <Option value="members">仅登录会员</Option>
              <Option value="groups">指定分组</Option>
            </Select>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.targetType !== curr.targetType}>
            {({ getFieldValue }) =>
              getFieldValue('targetType') === 'groups' && (
                <Form.Item label="目标分组" name="targetGroupIds">
                  <Select mode="multiple" placeholder="选择分组">
                    {groups.map(g => (
                      <Option key={g.id} value={g.id}>
                        <Tag color={g.color}>{g.name}</Tag>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              )
            }
          </Form.Item>
          <Form.Item label="置顶" name="isPinned" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AnnouncementList;

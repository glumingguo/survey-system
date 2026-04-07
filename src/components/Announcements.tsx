import React, { useEffect, useState, useRef } from 'react';
import {
  Card, Button, Modal, Form, Input, Select, Switch, Tag, Space,
  Popconfirm, message, Typography, List, Row, Col
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PushpinOutlined, RightOutlined } from '@ant-design/icons';
import {
  getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  getGroups, type Announcement, type UserGroup
} from '../api/site';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const API_BASE = import.meta.env.VITE_API_BASE || '';

interface SiteConfig {
  heroBanner?: string;
  menuLabels?: {
    resources?: string;
    albums?: string;
    surveys?: string;
  };
  moduleIcons?: {
    resources?: string;
    albums?: string;
    surveys?: string;
  };
  // 首页标题样式
  heroTitleStyle?: {
    fontSize?: number;
    subtitleFontSize?: number;
    titleColor?: string;
    subtitleColor?: string;
    position?: 'top' | 'center' | 'bottom';
  };
  // 首页滚动公告配置
  marqueeConfig?: {
    enabled?: boolean;
    announcementIds?: string[];
    fontSize?: number;
    color?: string;
    background?: string;
    speed?: number;
  };
  // 首页模块图片（优先于 emoji）
  moduleImages?: {
    resources?: string;
    albums?: string;
    surveys?: string;
  };
  // 首页背景配置
  homePageStyle?: {
    backgroundColor?: string;
    backgroundImage?: string;
    backgroundOpacity?: number;
    moduleCount?: number;
    containerPadding?: number;
  };
}

interface Props {
  siteConfig?: SiteConfig;
}

const AnnouncementPage: React.FC<Props> = ({ siteConfig }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form] = Form.useForm();

  // 从 siteConfig 读取菜单标签（向后兼容）
  const labels = {
    resources: siteConfig?.menuLabels?.resources || '资源库',
    albums: siteConfig?.menuLabels?.albums || '相册',
    surveys: siteConfig?.menuLabels?.surveys || '问卷',
  };

  const icons = {
    resources: siteConfig?.moduleIcons?.resources || '📁',
    albums: siteConfig?.moduleIcons?.albums || '🖼️',
    surveys: siteConfig?.moduleIcons?.surveys || '📝',
  };

  const heroBanner = siteConfig?.heroBanner;
  const marqueeConfig = siteConfig?.marqueeConfig;
  const homePageStyle = siteConfig?.homePageStyle;
  const moduleImages = siteConfig?.moduleImages;

  // 计算要显示的滚动公告
  const marqueeAnnouncements = marqueeConfig?.enabled
    ? (marqueeConfig.announcementIds?.length
      ? announcements.filter(a => marqueeConfig.announcementIds?.includes(a.id))
      : announcements)
    : [];

  // 计算要显示的模块数量
  const moduleCount = homePageStyle?.moduleCount ?? 3;

  // 背景样式
  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: homePageStyle?.backgroundColor || '#f0f2f5',
    padding: homePageStyle?.containerPadding || 24,
  };

  // 如果有背景图，添加背景样式
  if (homePageStyle?.backgroundImage) {
    containerStyle.backgroundImage = `url(${API_BASE}${homePageStyle.backgroundImage})`;
    containerStyle.backgroundSize = 'cover';
    containerStyle.backgroundPosition = 'center';
    containerStyle.backgroundAttachment = 'fixed';
  }

  // 标题样式配置
  const titleStyle = siteConfig?.heroTitleStyle || {};
  const titlePosition = titleStyle.position || 'center';
  const titleOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: titlePosition === 'top' ? '20%' : titlePosition === 'bottom' ? 'auto' : '50%',
    bottom: titlePosition === 'bottom' ? '20px' : 'auto',
    left: '50%',
    transform: titlePosition === 'center' ? 'translate(-50%, -50%)' : 'translateX(-50%)',
    textAlign: 'center',
    width: '100%',
    padding: '0 20px',
    zIndex: 10,
  };

  const allModuleCards = [
    {
      key: 'resources',
      icon: icons.resources,
      label: labels.resources,
      path: '/resources',
      color: '#1890ff',
      bg: '#e6f7ff',
      image: moduleImages?.resources,
    },
    {
      key: 'albums',
      icon: icons.albums,
      label: labels.albums,
      path: '/albums',
      color: '#eb2f96',
      bg: '#fff0f6',
      image: moduleImages?.albums,
    },
    {
      key: 'surveys',
      icon: icons.surveys,
      label: labels.surveys,
      path: '/surveys',
      color: '#52c41a',
      bg: '#f6ffed',
      image: moduleImages?.surveys,
    },
  ];

  // 根据配置限制模块数量
  const moduleCards = allModuleCards.slice(0, moduleCount);

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

  useEffect(() => { loadData(); }, []);

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
      message.success('已删除');
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
      targetGroupIds: ann.target_group_ids,
      isPinned: ann.is_pinned
    });
    setModalOpen(true);
  };

  return (
    <div style={containerStyle}>
      {/* 滚动公告 */}
      {marqueeConfig?.enabled && marqueeAnnouncements.length > 0 && (
        <div
          style={{
            width: '100%',
            background: marqueeConfig.background || 'rgba(0,0,0,0.5)',
            color: marqueeConfig.color || '#fff',
            fontSize: marqueeConfig.fontSize || 16,
            padding: '10px 0',
            marginBottom: heroBanner ? 0 : 24,
            borderRadius: heroBanner ? 0 : 8,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            className="marquee-content"
            style={{
              display: 'inline-block',
              whiteSpace: 'nowrap',
              animation: `marquee ${marqueeConfig.speed || 20}s linear infinite`,
              paddingLeft: '100%',
            }}
          >
            {marqueeAnnouncements.map((ann, idx) => (
              <span key={ann.id}>
                <strong>【{ann.title}】</strong> {ann.content.substring(0, 50)}
                {ann.content.length > 50 ? '...' : ''}
                {idx < marqueeAnnouncements.length - 1 && '　　•　　'}
              </span>
            ))}
          </div>
          {/* CSS 动画 */}
          <style>{`
            @keyframes marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-100%); }
            }
          `}</style>
        </div>
      )}

      {/* 主页横幅 + 标题叠加 */}
      {heroBanner && (
        <div
          style={{
            width: '100%',
            height: 220,
            borderRadius: marqueeConfig?.enabled ? '0 0 12px 12px' : 12,
            overflow: 'hidden',
            marginBottom: 24,
            background: '#f0f0f0',
            position: 'relative',
          }}
        >
          <img
            src={`${API_BASE}${heroBanner}`}
            alt="横幅"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {/* 标题叠加层 */}
          {(titleStyle.fontSize || titleStyle.titleColor) && (
            <div style={titleOverlayStyle}>
              <div
                style={{
                  fontSize: titleStyle.fontSize || 48,
                  fontWeight: 'bold',
                  color: titleStyle.titleColor || '#ffffff',
                  textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                  marginBottom: 8,
                }}
              >
                {siteConfig?.menuLabels?.dashboard || '首页'}
              </div>
              {siteConfig?.siteSubtitle && (
                <div
                  style={{
                    fontSize: titleStyle.subtitleFontSize || 18,
                    color: titleStyle.subtitleColor || 'rgba(255,255,255,0.85)',
                    textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                  }}
                >
                  {siteConfig.siteSubtitle}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 无横幅时显示标题 */}
      {!heroBanner && (titleStyle.fontSize || titleStyle.titleColor) && (
        <div style={{ textAlign: 'center', marginBottom: 24, ...titleOverlayStyle }}>
          <div
            style={{
              fontSize: titleStyle.fontSize || 48,
              fontWeight: 'bold',
              color: titleStyle.titleColor || '#1890ff',
              textShadow: '0 2px 8px rgba(0,0,0,0.1)',
              marginBottom: 8,
            }}
          >
            {siteConfig?.menuLabels?.dashboard || '首页'}
          </div>
          {siteConfig?.siteSubtitle && (
            <div
              style={{
                fontSize: titleStyle.subtitleFontSize || 18,
                color: titleStyle.subtitleColor || 'rgba(0,0,0,0.65)',
              }}
            >
              {siteConfig.siteSubtitle}
            </div>
          )}
        </div>
      )}

      {/* 模块图标卡片 */}
      {moduleCards.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {moduleCards.map((card) => (
            <Col xs={24} sm={24 / moduleCount} key={card.key}>
              <Card
                hoverable
                onClick={() => window.location.href = card.path}
                style={{
                  textAlign: 'center',
                  borderRadius: 12,
                  cursor: 'pointer',
                  background: card.bg,
                  border: 'none',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                styles={{ body: { padding: '28px 16px' } }}
              >
                <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  {card.image ? (
                    <img
                      src={`${API_BASE}${card.image}`}
                      alt={card.label}
                      style={{ maxWidth: 56, maxHeight: 56, objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{ fontSize: 48, lineHeight: 1 }}>
                      {card.icon}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: card.color, marginBottom: 4 }}>
                  {card.label}
                </div>
                <div style={{ color: '#888', fontSize: 12 }}>
                  点击进入 <RightOutlined style={{ fontSize: 10 }} />
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* 公告列表 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          {siteConfig?.menuLabels?.announcements || '公告通知'}
        </Title>
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

      <List
        loading={loading}
        dataSource={announcements}
        locale={{ emptyText: '暂无公告' }}
        renderItem={(ann) => (
          <Card
            style={{ marginBottom: 12 }}
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
            <div style={{ whiteSpace: 'pre-wrap', color: '#333', marginBottom: 8 }}>{ann.content}</div>
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

      <Modal
        title={editing ? '编辑公告' : '发布公告'}
        open={modalOpen}
        onOk={() => form.submit()}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        okText="发布"
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

export default AnnouncementPage;

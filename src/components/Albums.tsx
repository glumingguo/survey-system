import React, { useEffect, useState } from 'react';
import {
  Card, Button, Modal, Form, Input, Select, Upload, Image, Row, Col,
  Popconfirm, message, Typography, Tag, Empty, Space, Drawer
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined,
  PictureOutlined, LockOutlined
} from '@ant-design/icons';
import {
  getAlbums, createAlbum, updateAlbum, deleteAlbum, getAlbum,
  uploadPhotos, deletePhoto, getGroups, type Album, type AlbumPhoto, type UserGroup
} from '../api/site';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const API_BASE = import.meta.env.VITE_API_BASE || '';

const accessLabels: Record<string, string> = {
  public: '公开',
  members: '仅会员',
  groups: '指定分组'
};

const AlbumPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [albums, setAlbums] = useState<Album[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [albumModalOpen, setAlbumModalOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [form] = Form.useForm();
  const [viewAlbum, setViewAlbum] = useState<Album | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const loadData = async () => {
    setLoading(true);
    try {
      const [albumsData, groupsData] = await Promise.all([
        getAlbums(),
        isAdmin ? getGroups() : Promise.resolve([])
      ]);
      setAlbums(albumsData);
      setGroups(groupsData);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openAlbum = async (album: Album) => {
    try {
      const detail = await getAlbum(album.id);
      setViewAlbum(detail);
      setDrawerOpen(true);
    } catch {
      message.error('加载相册失败');
    }
  };

  const handleAlbumSubmit = async (values: any) => {
    try {
      if (editingAlbum) {
        await updateAlbum(editingAlbum.id, {
          name: values.name,
          description: values.description,
          accessType: values.accessType,
          allowedGroupIds: values.allowedGroupIds || []
        });
        message.success('相册已更新');
      } else {
        await createAlbum({
          name: values.name,
          description: values.description,
          accessType: values.accessType || 'members',
          allowedGroupIds: values.allowedGroupIds || []
        });
        message.success('相册已创建');
      }
      setAlbumModalOpen(false);
      setEditingAlbum(null);
      form.resetFields();
      loadData();
    } catch {
      message.error('操作失败');
    }
  };

  const handleDeleteAlbum = async (id: string) => {
    try {
      await deleteAlbum(id);
      message.success('相册已删除');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const handleUploadPhotos = async (fileList: File[]) => {
    if (!viewAlbum) return;
    setUploading(true);
    try {
      const newPhotos = await uploadPhotos(viewAlbum.id, fileList);
      setViewAlbum(prev => prev ? { ...prev, photos: [...(prev.photos || []), ...newPhotos] } : prev);
      message.success(`成功上传 ${newPhotos.length} 张照片`);
      loadData(); // 更新封面
    } catch {
      message.error('上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      await deletePhoto(photoId);
      setViewAlbum(prev => prev ? { ...prev, photos: (prev.photos || []).filter(p => p.id !== photoId) } : prev);
      message.success('照片已删除');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const photos = viewAlbum?.photos || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>相册</Title>
        {isAdmin && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setEditingAlbum(null); form.resetFields(); setAlbumModalOpen(true); }}
          >
            新建相册
          </Button>
        )}
      </div>

      {albums.length === 0 && !loading ? (
        <Empty description="暂无相册" />
      ) : (
        <Row gutter={[16, 16]}>
          {albums.map(album => (
            <Col key={album.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                onClick={() => openAlbum(album)}
                cover={
                  album.cover_image ? (
                    <div style={{ height: 160, overflow: 'hidden' }}>
                      <img
                        src={`${API_BASE}${album.cover_image}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        alt={album.name}
                      />
                    </div>
                  ) : (
                    <div style={{ height: 160, background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                      <PictureOutlined style={{ fontSize: 40, color: 'rgba(255,255,255,0.8)' }} />
                      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 8 }}>
                        {album.photoCount} 张照片
                      </div>
                    </div>
                  )
                }
                actions={
                  isAdmin ? [
                    <EditOutlined key="edit" onClick={(e) => {
                      e.stopPropagation();
                      setEditingAlbum(album);
                      form.setFieldsValue({
                        name: album.name,
                        description: album.description,
                        accessType: album.access_type,
                        allowedGroupIds: album.allowed_group_ids
                      });
                      setAlbumModalOpen(true);
                    }} />,
                    <Popconfirm
                      key="delete"
                      title="确认删除此相册及所有照片？"
                      onConfirm={(e) => { e?.stopPropagation(); handleDeleteAlbum(album.id); }}
                      okText="删除" okType="danger" cancelText="取消"
                    >
                      <DeleteOutlined style={{ color: '#ff4d4f' }} />
                    </Popconfirm>
                  ] : []
                }
              >
                <Card.Meta
                  title={album.name}
                  description={
                    <Space direction="vertical" size={2}>
                      {album.description && <Text type="secondary" style={{ fontSize: 12 }}>{album.description}</Text>}
                      <Space>
                        <Tag
                          color={album.access_type === 'public' ? 'green' : album.access_type === 'members' ? 'blue' : 'purple'}
                          icon={album.access_type !== 'public' ? <LockOutlined /> : undefined}
                        >
                          {accessLabels[album.access_type]}
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>{album.photoCount} 张</Text>
                      </Space>
                    </Space>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* 相册查看抽屉 */}
      <Drawer
        title={viewAlbum?.name || '相册'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={600}
        extra={
          isAdmin && viewAlbum && (
            <Upload
              beforeUpload={() => false}
              multiple
              accept="image/*"
              showUploadList={false}
              onChange={({ fileList }) => {
                const files = fileList.map(f => f.originFileObj!).filter(Boolean);
                if (files.length > 0) handleUploadPhotos(files);
              }}
            >
              <Button icon={<UploadOutlined />} loading={uploading}>上传照片</Button>
            </Upload>
          )
        }
      >
        {photos.length === 0 ? (
          <Empty description="相册暂无照片" />
        ) : (
          <Image.PreviewGroup
            preview={{
              visible: previewVisible,
              current: previewIndex,
              onVisibleChange: setPreviewVisible,
            }}
          >
            <Row gutter={[8, 8]}>
              {photos.map((photo, idx) => (
                <Col key={photo.id} span={8}>
                  <div style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', borderRadius: 4 }}>
                    <Image
                      src={`${API_BASE}${photo.file_path}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                      preview={{ src: `${API_BASE}${photo.file_path}` }}
                      onClick={() => { setPreviewIndex(idx); setPreviewVisible(true); }}
                      fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyBoBSSpyZOoOCkqgZoOBhQgDgdWLkqJMHiGYNJCCEU8KANcuHYWMSmJAA=="
                    />
                    {isAdmin && (
                      <Popconfirm
                        title="确认删除此照片？"
                        onConfirm={() => handleDeletePhoto(photo.id)}
                        okText="删除" okType="danger" cancelText="取消"
                      >
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          style={{ position: 'absolute', top: 4, right: 4, opacity: 0.85 }}
                          onClick={e => e.stopPropagation()}
                        />
                      </Popconfirm>
                    )}
                  </div>
                </Col>
              ))}
            </Row>
          </Image.PreviewGroup>
        )}
      </Drawer>

      {/* 相册编辑弹窗 */}
      <Modal
        title={editingAlbum ? '编辑相册' : '新建相册'}
        open={albumModalOpen}
        onOk={() => form.submit()}
        onCancel={() => { setAlbumModalOpen(false); setEditingAlbum(null); form.resetFields(); }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={handleAlbumSubmit}>
          <Form.Item label="相册名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：春日写真" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <TextArea rows={2} placeholder="相册说明（可选）" />
          </Form.Item>
          <Form.Item label="访问权限" name="accessType" initialValue="members">
            <Select>
              <Option value="public">公开（任何人可见）</Option>
              <Option value="members">仅会员可见</Option>
              <Option value="groups">指定分组可见</Option>
            </Select>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.accessType !== curr.accessType}>
            {({ getFieldValue }) =>
              getFieldValue('accessType') === 'groups' && (
                <Form.Item label="可访问分组" name="allowedGroupIds">
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
        </Form>
      </Modal>
    </div>
  );
};

export default AlbumPage;

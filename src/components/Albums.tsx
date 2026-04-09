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

  const [uploadFileList, setUploadFileList] = useState<any[]>([]);

  // 统一防复制配置（保护图片不被右键保存/拖拽保存）
  const protectedImageProps = {
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onDragStart: (e: React.DragEvent) => e.preventDefault(),
    onCopy: (e: React.ClipboardEvent) => e.preventDefault(),
    onSelectStart: (e: React.Event) => e.preventDefault(),
  };

  // 提交选中的照片
  const handleUploadSubmit = () => {
    const files = uploadFileList.map(f => f.originFileObj).filter(Boolean) as File[];
    if (files.length === 0) return;
    setUploadFileList([]); // 提交后立即清空，防止重传
    handleUploadPhotos(files);
  };

  // 关闭抽屉时清理状态
  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setUploadFileList([]); // 关闭时清空待上传列表
    setTimeout(() => setViewAlbum(null), 300);
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
    if (!viewAlbum || uploading) return;
    setUploading(true);
    try {
      // 前置过滤：排除相册中已存在的同名照片
      const existingNames = new Set((viewAlbum.photos || []).map(p => p.name));
      let newFiles = fileList.filter(f => {
        let name = f.name;
        if (name.includes('%')) {
          try { name = decodeURIComponent(name); } catch {}
        }
        return !existingNames.has(name);
      });

      if (newFiles.length === 0) {
        message.warning('所选照片均已在相册中存在，无需重复上传');
        setUploading(false);
        return;
      }

      const result = await uploadPhotos(viewAlbum.id, newFiles);
      const { inserted, skipped } = result;
      const insertedPhotos = Array.isArray(result) ? result : (inserted || []);

      // 更新本地相册照片列表
      setViewAlbum(prev => {
        if (!prev) return prev;
        return { ...prev, photos: [...(prev.photos || []), ...insertedPhotos] };
      });

      // 组合提示
      const parts = [];
      if (insertedPhotos.length > 0) parts.push(`成功上传 ${insertedPhotos.length} 张`);
      if (skipped?.length > 0) parts.push(`跳过 ${skipped.length} 张（相册中已存在）`);
      if (newFiles.length < fileList.length) parts.push(`过滤 ${fileList.length - newFiles.length} 张（同批次重复）`);
      message.success(parts.join('，'));

      // 单独更新相册列表，不影响当前查看状态
      const albumsData = await getAlbums();
      setAlbums(albumsData);
    } catch (err: any) {
      console.error('上传失败:', err);
      message.error(err?.response?.data?.error || '上传失败，请重试');
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
        onClose={handleDrawerClose}
        width={600}
        extra={
          isAdmin && viewAlbum && (
            <Space>
              {uploadFileList.length > 0 && (
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  loading={uploading}
                  onClick={handleUploadSubmit}
                >
                  上传 {uploadFileList.length} 张
                </Button>
              )}
              <Upload
                fileList={uploadFileList}
                beforeUpload={() => false}
                multiple
                accept="image/*"
                onChange={({ fileList: newList }) => {
                  // 避免触发父组件更新导致的重复追加
                  setUploadFileList(prev => {
                    const prevKeys = new Set(prev.map(f => f.name + f.size));
                    const added = newList.filter(f => !prevKeys.has(f.name + f.size));
                    return [...prev, ...added];
                  });
                }}
                onRemove={(file) => {
                  setUploadFileList(prev => prev.filter(f => f.uid !== file.uid));
                }}
              >
                <Button icon={<UploadOutlined />} disabled={uploading}>选择照片</Button>
              </Upload>
            </Space>
          )
        }
      >
        {photos.length === 0 ? (
          <Empty description="相册暂无照片" />
        ) : (
          <Row gutter={[8, 8]}>
            {photos.map((photo) => (
              <Col key={photo.id} span={8}>
                {/* 图片保护容器：禁止右键/拖拽 + 水印 */}
                <div
                  style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', borderRadius: 4 }}
                  onContextMenu={e => e.preventDefault()}
                  onDragStart={e => e.preventDefault()}
                >
                  {/* 水印层：覆盖在图片上方，不影响点击但截图会带水印 */}
                  <div style={{
                    position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{
                      color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600,
                      letterSpacing: 1, textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                      transform: 'rotate(-15deg)', userSelect: 'none', whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                    }}>
                      仅限站内浏览
                    </div>
                  </div>
                  <Image
                    src={`${API_BASE}${photo.file_path}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                    preview={isAdmin ? true : false}
                    {...protectedImageProps}
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

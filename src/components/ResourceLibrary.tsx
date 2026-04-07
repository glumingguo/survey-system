import React, { useEffect, useState } from 'react';
import {
  Card, Button, Modal, Form, Input, Select, Upload, Image, Space,
  Popconfirm, message, Typography, Row, Col, Tag, Drawer, Empty,
  Progress, Divider
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined,
  FolderOutlined, FileOutlined, DownloadOutlined, LockOutlined
} from '@ant-design/icons';
import {
  getResourceFolders, createResourceFolder, updateResourceFolder, deleteResourceFolder,
  getFolderFiles, uploadResourceFile, deleteResourceFile, getGroups,
  uploadSiteImage, type ResourceFolder, type ResourceFile, type UserGroup
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

const ResourceLibrary: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [folders, setFolders] = useState<ResourceFolder[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ResourceFolder | null>(null);
  const [form] = Form.useForm();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<ResourceFolder | null>(null);
  const [files, setFiles] = useState<ResourceFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [foldersData, groupsData] = await Promise.all([
        getResourceFolders(),
        isAdmin ? getGroups() : Promise.resolve([])
      ]);
      setFolders(foldersData);
      setGroups(groupsData);
    } catch {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openFolder = async (folder: ResourceFolder) => {
    setSelectedFolder(folder);
    setDrawerOpen(true);
    setFilesLoading(true);
    try {
      const data = await getFolderFiles(folder.id);
      setFiles(data);
    } catch {
      message.error('加载文件失败');
    } finally {
      setFilesLoading(false);
    }
  };

  const handleFolderSubmit = async (values: any) => {
    try {
      if (editingFolder) {
        await updateResourceFolder(editingFolder.id, {
          name: values.name,
          description: values.description,
          accessType: values.accessType,
          allowedGroupIds: values.allowedGroupIds || []
        });
        message.success('文件夹已更新');
      } else {
        await createResourceFolder({
          name: values.name,
          description: values.description,
          accessType: values.accessType || 'members',
          allowedGroupIds: values.allowedGroupIds || []
        });
        message.success('文件夹已创建');
      }
      setFolderModalOpen(false);
      setEditingFolder(null);
      form.resetFields();
      loadData();
    } catch {
      message.error('操作失败');
    }
  };

  const handleDeleteFolder = async (id: string) => {
    try {
      await deleteResourceFolder(id);
      message.success('删除成功');
      loadData();
    } catch {
      message.error('删除失败');
    }
  };

  const handleUploadFile = async (file: File) => {
    if (!selectedFolder) return;
    setUploading(true);
    try {
      const result = await uploadResourceFile(selectedFolder.id, file);
      setFiles(prev => [...prev, result]);
      message.success('上传成功');
    } catch {
      message.error('上传失败');
    } finally {
      setUploading(false);
    }
    return false;
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      await deleteResourceFile(fileId);
      setFiles(prev => prev.filter(f => f.id !== fileId));
      message.success('删除成功');
    } catch {
      message.error('删除失败');
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const getFileIcon = (type?: string) => {
    if (!type) return <FileOutlined />;
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
    if (type.includes('video')) return '🎬';
    if (type.includes('audio')) return '🎵';
    if (type.includes('zip') || type.includes('compressed')) return '📦';
    return '📁';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>资源库</Title>
        {isAdmin && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => { setEditingFolder(null); form.resetFields(); setFolderModalOpen(true); }}
          >
            新建文件夹
          </Button>
        )}
      </div>

      {folders.length === 0 && !loading ? (
        <Empty description="暂无资源文件夹" />
      ) : (
        <Row gutter={[16, 16]}>
          {folders.map(folder => (
            <Col key={folder.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                hoverable
                style={{ cursor: 'pointer' }}
                cover={
                  folder.cover_image ? (
                    <div style={{ height: 120, overflow: 'hidden' }}>
                      <img
                        src={`${API_BASE}${folder.cover_image}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        alt={folder.name}
                      />
                    </div>
                  ) : (
                    <div style={{ height: 120, background: '#f0f5ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FolderOutlined style={{ fontSize: 48, color: '#1890ff' }} />
                    </div>
                  )
                }
                actions={
                  isAdmin ? [
                    <EditOutlined key="edit" onClick={(e) => {
                      e.stopPropagation();
                      setEditingFolder(folder);
                      form.setFieldsValue({
                        name: folder.name,
                        description: folder.description,
                        accessType: folder.access_type,
                        allowedGroupIds: folder.allowed_group_ids
                      });
                      setFolderModalOpen(true);
                    }} />,
                    <Popconfirm
                      key="delete"
                      title="确认删除此文件夹及其所有文件？"
                      onConfirm={(e) => { e?.stopPropagation(); handleDeleteFolder(folder.id); }}
                      okText="删除" okType="danger" cancelText="取消"
                    >
                      <DeleteOutlined style={{ color: '#ff4d4f' }} />
                    </Popconfirm>
                  ] : []
                }
                onClick={() => openFolder(folder)}
              >
                <Card.Meta
                  title={folder.name}
                  description={
                    <Space direction="vertical" size={2}>
                      {folder.description && <Text type="secondary" style={{ fontSize: 12 }}>{folder.description}</Text>}
                      <Tag
                        color={folder.access_type === 'public' ? 'green' : folder.access_type === 'members' ? 'blue' : 'purple'}
                        icon={folder.access_type !== 'public' ? <LockOutlined /> : undefined}
                      >
                        {accessLabels[folder.access_type]}
                      </Tag>
                    </Space>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* 文件夹详情抽屉 */}
      <Drawer
        title={selectedFolder?.name || '文件夹'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={500}
        extra={
          isAdmin && selectedFolder && (
            <Upload beforeUpload={handleUploadFile} showUploadList={false}>
              <Button icon={<UploadOutlined />} loading={uploading}>上传文件</Button>
            </Upload>
          )
        }
      >
        {filesLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
        ) : files.length === 0 ? (
          <Empty description="文件夹为空" />
        ) : (
          files.map(file => (
            <Card key={file.id} size="small" style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <span style={{ fontSize: 20 }}>{getFileIcon(file.file_type)}</span>
                  <div>
                    <div>{file.original_name}</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {formatFileSize(file.file_size)} · {new Date(file.created_at!).toLocaleDateString('zh-CN')}
                    </Text>
                  </div>
                </Space>
                <Space>
                  <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    href={`${API_BASE}${file.file_path}`}
                    target="_blank"
                    download={file.original_name}
                  >
                    下载
                  </Button>
                  {isAdmin && (
                    <Popconfirm title="确认删除？" onConfirm={() => handleDeleteFile(file.id)} okText="删除" okType="danger" cancelText="取消">
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )}
                </Space>
              </div>
            </Card>
          ))
        )}
      </Drawer>

      {/* 文件夹编辑弹窗 */}
      <Modal
        title={editingFolder ? '编辑文件夹' : '新建文件夹'}
        open={folderModalOpen}
        onOk={() => form.submit()}
        onCancel={() => { setFolderModalOpen(false); setEditingFolder(null); form.resetFields(); }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={handleFolderSubmit}>
          <Form.Item label="文件夹名称" name="name" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如：学习资料" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <TextArea rows={2} placeholder="文件夹说明（可选）" />
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

export default ResourceLibrary;

import React, { useEffect, useState } from 'react';
import {
  Form, Input, Button, Card, message, Select, Divider,
  Upload, Image, Typography, Spin, Row, Col, InputNumber, Switch
} from 'antd';
import { UploadOutlined, PictureOutlined } from '@ant-design/icons';
import { getAdminSiteSettings, updateSiteSettings, uploadSiteImage, getAnnouncements, type SiteSettings } from '../api/site';

const { Title, Text } = Typography;
const { Option } = Select;

const API_BASE = import.meta.env.VITE_API_BASE || '';

// 预置图标选项
const ICON_OPTIONS = [
  { label: '📁 文件夹', value: '📁' },
  { label: '🖼️ 相册', value: '🖼️' },
  { label: '📝 问卷', value: '📝' },
  { label: '📋 列表', value: '📋' },
  { label: '📖 文档', value: '📖' },
  { label: '💎 宝石', value: '💎' },
  { label: '🎨 画板', value: '🎨' },
  { label: '📦 盒子', value: '📦' },
  { label: '🌟 星星', value: '🌟' },
  { label: '🎯 目标', value: '🎯' },
  { label: '🔑 钥匙', value: '🔑' },
  { label: '📱 设备', value: '📱' },
  { label: '💡 灯泡', value: '💡' },
  { label: '🔥 火焰', value: '🔥' },
  { label: '🎁 礼物', value: '🎁' },
  { label: '🏆 奖杯', value: '🏆' },
];

const SiteSettingsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SiteSettings>({});
  const [announcements, setAnnouncements] = useState<Array<{ id: string; title: string }>>([]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [data, annData] = await Promise.all([
        getAdminSiteSettings(),
        getAnnouncements()
      ]);
      // 确保 data 是对象而非字符串
      let settingsData = data;
      if (typeof data === 'string') {
        try {
          settingsData = JSON.parse(data);
        } catch {
          settingsData = {};
        }
      }
      // 确保 settingsData 是对象
      if (!settingsData || typeof settingsData !== 'object') {
        settingsData = {};
      }
      setSettings(settingsData);
      setAnnouncements(annData.map(a => ({ id: a.id, title: a.title })));
      form.setFieldsValue({
        siteName: settingsData.siteName || '',
        siteSubtitle: settingsData.siteSubtitle || '',
        registerMode: settingsData.registerMode || 'open',
      });
    } catch (err) {
      console.error('加载设置失败:', err);
      message.error('加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      const updated = await updateSiteSettings({ ...settings, ...values });
      setSettings(updated);
      message.success('设置已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file: File, field: keyof SiteSettings | `moduleConfigs.${string}.${string}` | `homePageStyle.${string}`) => {
    try {
      const url = await uploadSiteImage(file);
      let updated = { ...settings };

      if (typeof field === 'string' && field.includes('.')) {
        const parts = field.split('.');
        if (parts.length === 3) {
          // 处理 moduleConfigs.xxx.image 格式
          const [parent, moduleKey, child] = parts as [string, string, string];
          updated = {
            ...settings,
            [parent]: {
              ...(settings as any)[parent],
              [moduleKey]: {
                ...(settings as any)[parent]?.[moduleKey],
                [child]: url
              }
            }
          };
        } else {
          // 处理嵌套属性，如 homePageStyle.backgroundImage
          const [parent, child] = parts as [string, string];
          updated = {
            ...settings,
            [parent]: {
              ...(settings as any)[parent],
              [child]: url
            }
          };
        }
      } else {
        updated = { ...settings, [field]: url };
      }

      setSettings(updated);
      await updateSiteSettings(updated);
      message.success('图片上传成功');
    } catch {
      message.error('图片上传失败');
    }
    return false;
  };

  const ImageField: React.FC<{ label: string; field: keyof SiteSettings; desc: string }> = ({ label, field, desc }) => {
    const url = settings[field] as string;
    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <Text strong>{label}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{desc}</Text>
            <div style={{ marginTop: 8 }}>
              <Upload
                beforeUpload={(file) => handleImageUpload(file, field)}
                showUploadList={false}
                accept="image/*"
              >
                <Button icon={<UploadOutlined />}>上传图片</Button>
              </Upload>
              {url && (
                <Button
                  type="link"
                  danger
                  onClick={async () => {
                    const updated = { ...settings, [field]: '' };
                    setSettings(updated);
                    await updateSiteSettings(updated);
                    message.success('已清除');
                  }}
                >
                  清除
                </Button>
              )}
            </div>
          </div>
          <div style={{ width: 160, minHeight: 90, background: '#f5f5f5', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {url ? (
              <Image src={`${API_BASE}${url}`} style={{ maxWidth: 160, maxHeight: 90 }} preview={false} />
            ) : (
              <PictureOutlined style={{ fontSize: 32, color: '#ccc' }} />
            )}
          </div>
        </div>
      </Card>
    );
  };

  if (loading) return <Spin style={{ display: 'block', marginTop: 100, textAlign: 'center' }} />;

  return (
    <div style={{ maxWidth: 700 }}>
      <Title level={3}>网站设置</Title>

      <Card title="基本信息" style={{ marginBottom: 24 }}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item label="网站名称" name="siteName">
                <Input placeholder="我的个人空间" size="large" />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item label="副标题" name="siteSubtitle">
                <Input placeholder="一句话简介" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="注册方式"
            name="registerMode"
            extra="控制新用户如何加入你的网站"
          >
            <Select size="large">
              <Option value="open">开放注册（任何人可注册）</Option>
              <Option value="invite">邀请码注册（需要邀请码）</Option>
              <Option value="approval">审批注册（注册后需管理员审核）</Option>
              <Option value="closed">关闭注册</Option>
            </Select>
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={saving} size="large">
            保存基本设置
          </Button>
        </Form>
      </Card>

      <Card title="图片配置" style={{ marginBottom: 24 }}>
        <ImageField
          label="登录页背景图"
          field="loginBg"
          desc="显示在登录/注册页面的背景图片（建议 1920×1080）"
        />
        <ImageField
          label="侧边栏 Logo 图片"
          field="sidebarLogo"
          desc="显示在左侧导航栏顶部（建议 200×80，透明背景）"
        />
        <ImageField
          label="主页横幅/封面图"
          field="heroBanner"
          desc="显示在主页顶部的大图横幅（建议 1200×400）"
        />
      </Card>

      <Card title="侧边栏菜单名称" style={{ marginBottom: 24 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          自定义侧边栏各菜单项的显示名称，修改后首页模块名称也会同步更新。
        </Text>
        <Form
          layout="vertical"
          initialValues={settings.menuLabels || {}}
          onFinish={(values) => handleSave({ ...settings, menuLabels: values })}
        >
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="首页" name="dashboard">
                <Input placeholder="首页" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="公告通知" name="announcements">
                <Input placeholder="公告通知" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="私信留言" name="messages">
                <Input placeholder="私信留言" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="资源库" name="resources">
                <Input placeholder="资源库" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="相册" name="albums">
                <Input placeholder="相册" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="问卷" name="surveys">
                <Input placeholder="问卷" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="会员管理" name="members">
                <Input placeholder="会员管理" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="邀请码" name="inviteCodes">
                <Input placeholder="邀请码" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="访客统计" name="visitStats">
                <Input placeholder="访客统计" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="网站设置" name="siteSettings">
                <Input placeholder="网站设置" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="邮件配置" name="emailSettings">
                <Input placeholder="邮件配置" />
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" htmlType="submit" loading={saving}>
            保存菜单名称
          </Button>
        </Form>
      </Card>

      {/* 首页模块配置（合并图标和图片） */}
      <Card title="首页模块配置" style={{ marginBottom: 24 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          设置首页模块卡片的图标或图片（图片优先于 emoji 图标显示）。
        </Text>
        <Row gutter={16}>
          {['resources', 'albums', 'surveys'].map((module) => {
            const moduleLabels = { resources: '资源库', albums: '相册', surveys: '问卷' };
            const moduleName = module as 'resources' | 'albums' | 'surveys';
            const config = settings.moduleConfigs?.[moduleName] || {};
            return (
              <Col span={8} key={module}>
                <Card size="small" style={{ marginBottom: 8 }}>
                  <Text strong>{moduleLabels[module as keyof typeof moduleLabels]}</Text>
                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>图标（Emoji）</Text>
                    <Select
                      placeholder="选择图标"
                      allowClear
                      style={{ width: '100%', marginTop: 4 }}
                      value={config.icon}
                      onChange={(value) => {
                        const updated = {
                          ...settings,
                          moduleConfigs: {
                            ...settings.moduleConfigs,
                            [moduleName]: { ...config, icon: value, image: config.image }
                          }
                        };
                        setSettings(updated);
                        updateSiteSettings(updated);
                      }}
                    >
                      {ICON_OPTIONS.map(opt => (
                        <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>图片（优先于图标）</Text>
                    <div style={{ marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Upload
                        beforeUpload={(file) => {
                          handleImageUpload(file, `moduleConfigs.${module}.image` as any);
                          return false;
                        }}
                        showUploadList={false}
                        accept="image/*"
                      >
                        <Button icon={<UploadOutlined />} size="small">上传</Button>
                      </Upload>
                      {config.image && (
                        <Button
                          type="link"
                          danger
                          size="small"
                          onClick={async () => {
                            const updated = {
                              ...settings,
                              moduleConfigs: {
                                ...settings.moduleConfigs,
                                [moduleName]: { ...config, icon: config.icon, image: '' }
                              }
                            };
                            setSettings(updated);
                            await updateSiteSettings(updated);
                            message.success('已清除');
                          }}
                        >
                          清除
                        </Button>
                      )}
                    </div>
                    <div style={{ marginTop: 8, height: 48, background: '#f5f5f5', borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {config.image ? (
                        <Image src={`${API_BASE}${config.image}`} style={{ maxWidth: 64, maxHeight: 48, objectFit: 'contain' }} preview={false} />
                      ) : (
                        <Text type="secondary" style={{ fontSize: 12 }}>{config.icon || '未设置'}</Text>
                      )}
                    </div>
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      </Card>

      {/* 首页标题样式配置 */}
      <Card title="首页标题样式" style={{ marginBottom: 24 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          设置网站名称和副标题在封面图上方的显示样式（文字会叠加在横幅图片上方）。
        </Text>
        <Form
          layout="vertical"
          initialValues={{
            fontSize: settings.heroTitleStyle?.fontSize || 48,
            subtitleFontSize: settings.heroTitleStyle?.subtitleFontSize || 18,
            titleColor: settings.heroTitleStyle?.titleColor || '#ffffff',
            subtitleColor: settings.heroTitleStyle?.subtitleColor || 'rgba(255,255,255,0.85)',
            position: settings.heroTitleStyle?.position || 'center',
            bannerOpacity: settings.heroTitleStyle?.bannerOpacity ?? 1,
          }}
          onFinish={(values) => handleSave({
            ...settings,
            heroTitleStyle: {
              fontSize: values.fontSize,
              subtitleFontSize: values.subtitleFontSize,
              titleColor: values.titleColor,
              subtitleColor: values.subtitleColor,
              position: values.position,
              bannerOpacity: values.bannerOpacity,
            }
          })}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="标题位置" name="position">
                <Select>
                  <Option value="top">顶部</Option>
                  <Option value="center">居中</Option>
                  <Option value="bottom">底部</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="标题字号" name="fontSize">
                <InputNumber min={20} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="副标题字号" name="subtitleFontSize">
                <InputNumber min={12} max={50} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="标题颜色" name="titleColor">
                <Input placeholder="#ffffff 或 rgba(255,255,255,0.85)" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="副标题颜色" name="subtitleColor">
                <Input placeholder="rgba(255,255,255,0.85)" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="封面图透明度" name="bannerOpacity" tooltip="设置封面图片的透明度，0 为完全透明，1 为完全不透明">
                <InputNumber min={0} max={1} step={0.1} precision={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" htmlType="submit" loading={saving}>
            保存标题样式
          </Button>
        </Form>
      </Card>

      {/* 滚动公告配置 */}
      <Card title="首页滚动公告" style={{ marginBottom: 24 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          在首页顶部显示滚动播放的公告内容，吸引用户注意。
        </Text>
        <Form
          layout="vertical"
          initialValues={{
            enabled: settings.marqueeConfig?.enabled ?? false,
            announcementIds: settings.marqueeConfig?.announcementIds || [],
            fontSize: settings.marqueeConfig?.fontSize || 16,
            color: settings.marqueeConfig?.color || '#ffffff',
            background: settings.marqueeConfig?.background || 'rgba(0,0,0,0.5)',
            speed: settings.marqueeConfig?.speed || 20,
          }}
          onFinish={(values) => handleSave({
            ...settings,
            marqueeConfig: {
              enabled: values.enabled,
              announcementIds: values.announcementIds,
              fontSize: values.fontSize,
              color: values.color,
              background: values.background,
              speed: values.speed,
            }
          })}
        >
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label="启用滚动公告" name="enabled" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item label="选择公告（留空则显示所有公告）" name="announcementIds">
                <Select mode="multiple" placeholder="选择要滚动的公告" allowClear>
                  {announcements.map(ann => (
                    <Option key={ann.id} value={ann.id}>{ann.title}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="字体大小" name="fontSize">
                <InputNumber min={12} max={32} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="滚动速度（秒）" name="speed">
                <InputNumber min={5} max={60} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="文字颜色" name="color">
                <Input placeholder="#ffffff 或 rgba(0,0,0,0.5)" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="背景颜色" name="background">
                <Input placeholder="rgba(0,0,0,0.5)" />
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" htmlType="submit" loading={saving}>
            保存滚动公告设置
          </Button>
        </Form>
      </Card>

      {/* 首页背景配置 */}
      <Card title="首页背景样式" style={{ marginBottom: 24 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          自定义首页背景颜色、背景图以及模块卡片的显示数量。
        </Text>
        <Form
          layout="vertical"
          initialValues={{
            backgroundColor: settings.homePageStyle?.backgroundColor || '#f0f2f5',
            backgroundOpacity: settings.homePageStyle?.backgroundOpacity ?? 1,
            moduleCount: settings.homePageStyle?.moduleCount || 3,
            containerPadding: settings.homePageStyle?.containerPadding || 24,
          }}
          onFinish={(values) => handleSave({
            ...settings,
            homePageStyle: {
              backgroundColor: values.backgroundColor,
              backgroundImage: settings.homePageStyle?.backgroundImage,
              backgroundOpacity: values.backgroundOpacity,
              moduleCount: values.moduleCount,
              containerPadding: values.containerPadding,
            }
          })}
        >
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item label="背景颜色" name="backgroundColor">
                <Input placeholder="#f0f2f5" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="模块数量" name="moduleCount">
                <Select>
                  <Option value={1}>1个模块</Option>
                  <Option value={2}>2个模块</Option>
                  <Option value={3}>3个模块</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="内容区内边距" name="containerPadding">
                <InputNumber min={0} max={48} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="背景图透明度" name="backgroundOpacity">
                <InputNumber min={0} max={1} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Divider />
          <Text strong>背景图片（可选）</Text>
          <div style={{ marginTop: 8, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <Upload
                beforeUpload={(file) => {
                  handleImageUpload(file, 'homePageStyle.backgroundImage' as any);
                  return false;
                }}
                showUploadList={false}
                accept="image/*"
              >
                <Button icon={<UploadOutlined />}>上传背景图</Button>
              </Upload>
              {(settings.homePageStyle?.backgroundImage) && (
                <Button
                  type="link"
                  danger
                  onClick={async () => {
                    const updated = {
                      ...settings,
                      homePageStyle: { ...settings.homePageStyle, backgroundImage: '' }
                    };
                    setSettings(updated);
                    await updateSiteSettings(updated);
                    message.success('已清除');
                  }}
                >
                  清除背景图
                </Button>
              )}
            </div>
            <div style={{ width: 200, height: 100, background: '#f5f5f5', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {settings.homePageStyle?.backgroundImage ? (
                <Image src={`${API_BASE}${settings.homePageStyle.backgroundImage}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} preview={false} />
              ) : (
                <PictureOutlined style={{ fontSize: 32, color: '#ccc' }} />
              )}
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <Button type="primary" htmlType="submit" loading={saving}>
              保存背景样式
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default SiteSettingsPage;

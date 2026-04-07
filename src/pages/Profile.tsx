import React, { useEffect, useState } from 'react';
import {
  Card, Form, Input, Button, Select, DatePicker, Upload, Avatar, message,
  Row, Col, Typography, Divider, Space, Switch, Tabs, List, Tag
} from 'antd';
import { UserOutlined, UploadOutlined, CameraOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getUserProfile, updateUserProfile, uploadAvatar, type UserProfile } from '../api/auth';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const API_BASE = import.meta.env.VITE_API_BASE || '';

const ProfilePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({});
  const [form] = Form.useForm();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await getUserProfile();
      setProfile(data);
      form.setFieldsValue({
        nickname: data.nickname || '',
        gender: data.gender || '',
        age: data.age || undefined,
        birthday: data.birthday || '',
        occupation: data.occupation || '',
        marital_status: data.marital_status || '',
        province: data.province || '',
        city: data.city || '',
        district: data.district || '',
        address: data.address || '',
        phone: data.phone || '',
        wechat: data.wechat || '',
        qq: data.qq || '',
        bio: data.bio || '',
        interests: data.interests || '',
        education: data.education || '',
        income_range: data.income_range || '',
        birthday_public: data.birthday_public || false,
        contact_public: data.contact_public || false,
      });
    } catch (error: any) {
      message.error(error.response?.data?.error || '加载资料失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      await updateUserProfile(values);
      message.success('资料更新成功');
      loadProfile();
    } catch (error: any) {
      message.error(error.response?.data?.error || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    try {
      const url = await uploadAvatar(file);
      setProfile({ ...profile, avatar_url: url, avatar: url });
      message.success('头像上传成功');
    } catch {
      message.error('头像上传失败');
    }
    return false;
  };

  const avatarUrl = profile.avatar_url || profile.avatar;

  // 预定义选项
  const genderOptions = [
    { label: '男', value: 'male' },
    { label: '女', value: 'female' },
    { label: '保密', value: 'other' },
  ];

  const maritalOptions = [
    { label: '未婚', value: 'single' },
    { label: '已婚', value: 'married' },
    { label: '离异', value: 'divorced' },
    { label: '丧偶', value: 'widowed' },
  ];

  const educationOptions = [
    { label: '初中及以下', value: 'junior' },
    { label: '高中/中专', value: 'high_school' },
    { label: '大专', value: 'college' },
    { label: '本科', value: 'bachelor' },
    { label: '硕士', value: 'master' },
    { label: '博士', value: 'doctor' },
  ];

  const incomeOptions = [
    { label: '5000以下', value: '0-5000' },
    { label: '5000-10000', value: '5000-10000' },
    { label: '10000-20000', value: '10000-20000' },
    { label: '20000-50000', value: '20000-50000' },
    { label: '50000以上', value: '50000+' },
  ];

  const interestTags = ['阅读', '音乐', '电影', '旅行', '美食', '运动', '游戏', '摄影', '绘画', '编程', '园艺', '宠物', '收藏'];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px' }}>
      <Title level={3}>个人中心</Title>

      {/* 头像区域 */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ position: 'relative' }}>
            <Avatar
              size={100}
              src={avatarUrl ? `${API_BASE}${avatarUrl}` : undefined}
              icon={<UserOutlined />}
              style={{ backgroundColor: '#1890ff' }}
            />
            <Upload
              beforeUpload={handleAvatarUpload}
              showUploadList={false}
              accept="image/*"
            >
              <Button
                type="primary"
                shape="circle"
                icon={<CameraOutlined />}
                size="small"
                style={{ position: 'absolute', bottom: 0, right: 0 }}
              />
            </Upload>
          </div>
          <div>
            <Title level={5} style={{ margin: 0 }}>{profile.nickname || profile.username}</Title>
            <Text type="secondary">{profile.email}</Text>
            <br />
            <Tag color={profile.isProfileCompleted ? 'green' : 'orange'}>
              {profile.isProfileCompleted ? '资料已完善' : '资料未完善'}
            </Tag>
          </div>
        </div>
      </Card>

      {/* 资料编辑表单 */}
      <Card>
        <Tabs
          items={[
            {
              key: 'basic',
              label: '基本信息',
              children: (
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleSave}
                  initialValues={profile}
                >
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="昵称" name="nickname">
                        <Input placeholder="设置您的昵称" maxLength={50} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="性别" name="gender">
                        <Select placeholder="选择性别" allowClear>
                          {genderOptions.map(opt => (
                            <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="年龄" name="age">
                        <Input type="number" placeholder="请输入年龄" min={1} max={150} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="生日" name="birthday">
                        <Input placeholder="如：1990-01-01" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="职业" name="occupation">
                        <Input placeholder="您从事的职业" maxLength={100} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="婚姻状况" name="marital_status">
                        <Select placeholder="选择婚姻状况" allowClear>
                          {maritalOptions.map(opt => (
                            <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="学历" name="education">
                        <Select placeholder="选择学历" allowClear>
                          {educationOptions.map(opt => (
                            <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="收入范围" name="income_range">
                        <Select placeholder="选择收入范围" allowClear>
                          {incomeOptions.map(opt => (
                            <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                          ))}
                        </Select>
                      </Form.Item>
                  </Row>

                  <Form.Item label="个人简介" name="bio">
                    <TextArea rows={4} placeholder="介绍一下自己..." maxLength={500} showCount />
                  </Form.Item>

                  <Button type="primary" htmlType="submit" loading={saving} size="large">
                    保存基本信息
                  </Button>
                </Form>
              ),
            },
            {
              key: 'contact',
              label: '联系方式',
              children: (
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleSave}
                  initialValues={profile}
                >
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="所在省份" name="province">
                        <Input placeholder="如：广东" maxLength={50} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="所在城市" name="city">
                        <Input placeholder="如：深圳" maxLength={50} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="所在区县" name="district">
                        <Input placeholder="如：南山区" maxLength={50} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="详细地址" name="address">
                        <Input placeholder="街道门牌号等" maxLength={200} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="联系电话" name="phone">
                        <Input placeholder="手机或电话号码" maxLength={50} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="微信号" name="wechat">
                        <Input placeholder="您的微信号" maxLength={100} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item label="QQ号" name="qq">
                        <Input placeholder="您的QQ号" maxLength={50} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider />

                  <Space direction="vertical">
                    <Form.Item label="生日公开" name="birthday_public" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                    <Text type="secondary">开启后，其他会员可以看到您的生日信息</Text>

                    <Form.Item label="联系方式公开" name="contact_public" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                    <Text type="secondary">开启后，其他会员可以看到您的联系方式</Text>
                  </Space>

                  <div style={{ marginTop: 24 }}>
                    <Button type="primary" htmlType="submit" loading={saving} size="large">
                      保存联系方式
                    </Button>
                  </div>
                </Form>
              ),
            },
            {
              key: 'hobbies',
              label: '兴趣爱好',
              children: (
                <Form
                  form={form}
                  layout="vertical"
                  onFinish={handleSave}
                  initialValues={profile}
                >
                  <Form.Item label="个人爱好" name="interests">
                    <TextArea
                      rows={4}
                      placeholder="描述您的兴趣爱好，如：喜欢阅读科幻小说、周末喜欢徒步旅行、偶尔玩玩游戏..."
                      maxLength={500}
                      showCount
                    />
                  </Form.Item>

                  <Divider />

                  <Text type="secondary">常用兴趣标签（可参考）：</Text>
                  <div style={{ marginTop: 12 }}>
                    <Space wrap>
                      {interestTags.map(tag => (
                        <Tag key={tag} color="blue" style={{ cursor: 'pointer' }} onClick={() => {
                          const current = form.getFieldValue('interests') || '';
                          if (!current.includes(tag)) {
                            form.setFieldValue('interests', current ? `${current}、${tag}` : tag);
                          }
                        }}>
                          {tag}
                        </Tag>
                      ))}
                    </Space>
                  </div>

                  <div style={{ marginTop: 24 }}>
                    <Button type="primary" htmlType="submit" loading={saving} size="large">
                      保存兴趣爱好
                    </Button>
                  </div>
                </Form>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default ProfilePage;

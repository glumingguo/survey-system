import React, { useState, useEffect } from 'react';
import { 
  Form, 
  Input, 
  Button, 
  Card, 
  message, 
  Space, 
  Typography,
  Divider,
  Alert,
  Switch
} from 'antd';
import { 
  SaveOutlined, 
  MailOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import axios from 'axios';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  to: string;
  enabled: boolean;
}

const EmailSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchEmailConfig();
  }, []);

  const fetchEmailConfig = async () => {
    try {
      const response = await axios.get('/api/settings/email');
      form.setFieldsValue(response.data);
    } catch (error) {
      message.error('获取邮件配置失败');
    }
  };

  const handleSave = async (values: EmailConfig) => {
    try {
      setLoading(true);
      const response = await axios.post('/api/settings/email', values);
      message.success(response.data.message || '邮件配置保存成功');
    } catch (error: any) {
      const errMsg = error.response?.data?.error || error.message || '未知错误';
      message.error(`保存失败: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTestEmail = async () => {
    try {
      setTesting(true);
      const response = await axios.post('/api/settings/email/test');
      message.success(response.data.message || '测试邮件发送成功');
    } catch (error: any) {
      const errMsg = error.response?.data?.error || error.message || '未知错误';
      message.error(`测试邮件发送失败: ${errMsg}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <Title level={2}>邮件配置</Title>

      <Alert
        message="邮件功能说明"
        description="配置邮件后，问卷提交后会自动将答卷内容发送到指定邮箱。支持 SMTP 协议的邮件服务器。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />

      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            port: 587,
            secure: false,
            enabled: true
          }}
        >
          <Form.Item
            label="启用邮件通知"
            name="enabled"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Divider>SMTP 服务器配置</Divider>

          <Form.Item
            label="SMTP 服务器地址"
            name="host"
            rules={[{ required: true, message: '请输入 SMTP 服务器地址' }]}
          >
            <Input placeholder="例如: smtp.qq.com" />
          </Form.Item>

          <Form.Item
            label="SMTP 端口"
            name="port"
            rules={[{ required: true, message: '请输入 SMTP 端口' }]}
          >
            <Input type="number" placeholder="例如: 587" />
          </Form.Item>

          <Form.Item
            label="使用 SSL/TLS"
            name="secure"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label="SMTP用户名"
            name="user"
            rules={[{ required: true, message: '请输入SMTP用户名' }]}
          >
            <Input placeholder="例如: your-email@qq.com" />
          </Form.Item>

          <Form.Item
            label="邮箱密码/授权码"
            name="pass"
            rules={[{ required: true, message: '请输入邮箱密码或授权码' }]}
          >
            <Input.Password placeholder="请输入邮箱密码或授权码" />
          </Form.Item>

          <Form.Item
            label="发件人名称"
            name="fromName"
            rules={[{ required: true, message: '请输入发件人名称' }]}
          >
            <Input placeholder="例如: 问卷系统" />
          </Form.Item>

          <Form.Item
            label="发件人邮箱"
            name="fromEmail"
            rules={[{ required: true, message: '请输入发件人邮箱' }]}
          >
            <Input placeholder="例如: 问卷系统 <your-email@qq.com>" />
          </Form.Item>

          <Divider>接收邮箱配置</Divider>

          <Form.Item
            label="默认接收邮箱"
            name="to"
            rules={[{ required: true, message: '请输入接收邮箱' }]}
            extra="如果答卷中没有填写邮箱，则发送到此邮箱"
          >
            <Input placeholder="例如: admin@example.com" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button 
                type="primary" 
                htmlType="submit" 
                icon={<SaveOutlined />}
                loading={loading}
              >
                保存配置
              </Button>
              <Button 
                onClick={handleTestEmail}
                loading={testing}
              >
                发送测试邮件
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Title level={4}>常见邮件服务配置参考</Title>
        <div style={{ marginTop: 16 }}>
          <Title level={5}>QQ 邮箱</Title>
          <Text>SMTP 服务器: smtp.qq.com</Text>
          <br />
          <Text>端口: 587 (TLS) 或 465 (SSL)</Text>
          <br />
          <Text type="secondary">注意: 需要在邮箱设置中开启 SMTP 服务并获取授权码</Text>
        </div>

        <Divider />

        <div>
          <Title level={5}>Gmail</Title>
          <Text>SMTP 服务器: smtp.gmail.com</Text>
          <br />
          <Text>端口: 587 (TLS)</Text>
          <br />
          <Text type="secondary">注意: 需要在 Google 账户设置中启用"两步验证"并使用应用专用密码</Text>
        </div>

        <Divider />

        <div>
          <Title level={5}>163 邮箱</Title>
          <Text>SMTP 服务器: smtp.163.com</Text>
          <br />
          <Text>端口: 465 (SSL)</Text>
          <br />
          <Text type="secondary">注意: 需要在邮箱设置中开启 SMTP 服务</Text>
        </div>
      </Card>
    </div>
  );
};

export default EmailSettings;

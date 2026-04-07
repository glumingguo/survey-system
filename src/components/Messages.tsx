import React, { useEffect, useState, useRef } from 'react';
import {
  Input, Button, List, Avatar, Typography, Spin, Badge, Space, Select, Divider
} from 'antd';
import { SendOutlined, UserOutlined } from '@ant-design/icons';
import { getMessages, getMessagesWith, sendMessage, type Message } from '../api/site';
import { useAuth } from '../context/AuthContext';

const { Text } = Typography;
const { Option } = Select;

interface ConversationUser {
  user_id: string;
  username: string;
  last_message: string;
  last_time: string;
  unread_count: string;
}

const MessagesPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<ConversationUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const loadConversations = async () => {
    if (!isAdmin) return;
    try {
      const data = await getMessages();
      setConversations(data as ConversationUser[]);
    } catch {
      setConversations([]);
    }
  };

  const loadMessages = async (targetUserId?: string) => {
    setLoading(true);
    try {
      let data: Message[];
      if (isAdmin && targetUserId) {
        data = await getMessagesWith(targetUserId);
      } else {
        data = await getMessages() as Message[];
      }
      setMessages(data);
      scrollToBottom();
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadConversations();
    } else {
      loadMessages();
    }
  }, []);

  useEffect(() => {
    if (isAdmin && selectedUserId) {
      loadMessages(selectedUserId);
    }
  }, [selectedUserId]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    setSending(true);
    try {
      const msg = await sendMessage(inputText, isAdmin ? selectedUserId || undefined : undefined);
      setMessages(prev => [...prev, msg]);
      setInputText('');
      scrollToBottom();
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  const renderMessage = (msg: Message) => {
    const isMine = msg.sender_id === user?.id;
    return (
      <div
        key={msg.id}
        style={{
          display: 'flex',
          flexDirection: isMine ? 'row-reverse' : 'row',
          alignItems: 'flex-end',
          marginBottom: 12,
          gap: 8
        }}
      >
        <Avatar
          icon={<UserOutlined />}
          style={{ backgroundColor: isMine ? '#1890ff' : '#52c41a', flexShrink: 0 }}
        />
        <div style={{ maxWidth: '65%' }}>
          <div style={{ fontSize: 11, color: '#999', textAlign: isMine ? 'right' : 'left', marginBottom: 3 }}>
            {isMine ? '我' : (msg.sender_name || '对方')}
          </div>
          <div
            style={{
              padding: '10px 14px',
              borderRadius: isMine ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
              background: isMine ? '#1890ff' : '#f0f0f0',
              color: isMine ? '#fff' : '#333',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap'
            }}
          >
            {msg.content}
          </div>
          <div style={{ fontSize: 10, color: '#bbb', textAlign: isMine ? 'right' : 'left', marginTop: 3 }}>
            {new Date(msg.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ height: 'calc(100vh - 160px)', display: 'flex', flexDirection: 'column' }}>
      <Text strong style={{ fontSize: 20, marginBottom: 16, display: 'block' }}>
        {isAdmin ? '私信管理' : '给管理员留言'}
      </Text>

      {isAdmin && conversations.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Select
            placeholder="选择查看哪位用户的对话"
            style={{ width: 280 }}
            value={selectedUserId}
            onChange={setSelectedUserId}
          >
            {conversations.map(c => (
              <Option key={c.user_id} value={c.user_id}>
                <Space>
                  <UserOutlined />
                  {c.username}
                  {parseInt(c.unread_count) > 0 && (
                    <Badge count={parseInt(c.unread_count)} size="small" />
                  )}
                </Space>
              </Option>
            ))}
          </Select>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', border: '1px solid #e8e8e8', borderRadius: 8, padding: 16, background: '#fafafa' }}>
        {loading ? (
          <Spin style={{ display: 'block', margin: '40px auto' }} />
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#bbb', marginTop: 60 }}>
            {isAdmin && !selectedUserId ? '选择一位用户查看对话' : '暂无消息，发送第一条吧~'}
          </div>
        ) : (
          messages.map(renderMessage)
        )}
        <div ref={bottomRef} />
      </div>

      {(!isAdmin || selectedUserId) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Input.TextArea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder="输入消息..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            onPressEnter={e => {
              if (!e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={sending}
            style={{ height: 'auto' }}
          >
            发送
          </Button>
        </div>
      )}
    </div>
  );
};

export default MessagesPage;

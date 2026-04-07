import React, { useEffect, useState } from 'react';
import {
  Card, Typography, Row, Col
} from 'antd';
import { RightOutlined } from '@ant-design/icons';
import {
  getAnnouncements, type Announcement
} from '../api/site';

const { Text } = Typography;

const API_BASE = import.meta.env.VITE_API_BASE || '';

interface ModuleConfig {
  icon?: string;
  image?: string;
  label?: string;
}

interface SiteConfig {
  heroBanner?: string;
  siteName?: string;
  siteSubtitle?: string;
  menuLabels?: {
    resources?: string;
    albums?: string;
    surveys?: string;
  };
  moduleConfigs?: {
    resources?: ModuleConfig;
    albums?: ModuleConfig;
    surveys?: ModuleConfig;
  };
  heroTitleStyle?: {
    fontSize?: number;
    subtitleFontSize?: number;
    titleColor?: string;
    subtitleColor?: string;
    position?: 'top' | 'center' | 'bottom';
    bannerOpacity?: number;
  };
  marqueeConfig?: {
    enabled?: boolean;
    announcementIds?: string[];
    fontSize?: number;
    color?: string;
    background?: string;
    speed?: number;
  };
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

const HomePage: React.FC<Props> = ({ siteConfig }) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // 从 siteConfig 读取模块配置
  const moduleConfigs = siteConfig?.moduleConfigs || {};

  // 默认配置
  const defaultModules = {
    resources: { icon: '📁', label: '资源库' },
    albums: { icon: '🖼️', label: '相册' },
    surveys: { icon: '📝', label: '问卷' },
  };

  // 从 siteConfig 读取菜单标签
  const labels = {
    resources: siteConfig?.menuLabels?.resources || moduleConfigs.resources?.label || defaultModules.resources.label,
    albums: siteConfig?.menuLabels?.albums || moduleConfigs.albums?.label || defaultModules.albums.label,
    surveys: siteConfig?.menuLabels?.surveys || moduleConfigs.surveys?.label || defaultModules.surveys.label,
  };

  // 模块图标和图片
  const icons = {
    resources: moduleConfigs.resources?.icon || defaultModules.resources.icon,
    albums: moduleConfigs.albums?.icon || defaultModules.albums.icon,
    surveys: moduleConfigs.surveys?.icon || defaultModules.surveys.icon,
  };

  const heroBanner = siteConfig?.heroBanner;
  const marqueeConfig = siteConfig?.marqueeConfig;
  const homePageStyle = siteConfig?.homePageStyle;

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
    position: 'relative',
  };

  // 背景图透明度
  const bgOpacity = homePageStyle?.backgroundOpacity ?? 1;

  // 背景遮罩层样式（用于实现背景图透明度效果）
  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: homePageStyle?.backgroundImage ? `url(${API_BASE}${homePageStyle.backgroundImage})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    opacity: bgOpacity,
    pointerEvents: 'none',
    zIndex: 0,
  };

  // 如果有背景图，添加背景样式
  if (homePageStyle?.backgroundImage) {
    // 背景色设置在内容层
    containerStyle.backgroundColor = homePageStyle?.backgroundColor || '#f0f2f5';
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
      image: moduleConfigs.resources?.image,
    },
    {
      key: 'albums',
      icon: icons.albums,
      label: labels.albums,
      path: '/albums',
      color: '#eb2f96',
      bg: '#fff0f6',
      image: moduleConfigs.albums?.image,
    },
    {
      key: 'surveys',
      icon: icons.surveys,
      label: labels.surveys,
      path: '/surveys',
      color: '#52c41a',
      bg: '#f6ffed',
      image: moduleConfigs.surveys?.image,
    },
  ];

  // 根据配置限制模块数量
  const moduleCards = allModuleCards.slice(0, moduleCount);

  useEffect(() => {
    // 只加载公告用于滚动显示
    if (marqueeConfig?.enabled) {
      getAnnouncements().then(setAnnouncements).catch(() => {});
    }
  }, [marqueeConfig?.enabled]);

  return (
    <div style={containerStyle}>
      {/* 背景遮罩层（用于背景图和透明度） */}
      {homePageStyle?.backgroundImage && (
        <div style={overlayStyle} />
      )}
      {/* 内容层 */}
      <div style={{ position: 'relative', zIndex: 1 }}>
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
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: titleStyle.bannerOpacity !== undefined ? titleStyle.bannerOpacity : 1,
            }}
          />
          {/* 半透明黑色遮罩（增强文字可读性） */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: `rgba(0,0,0,${titleStyle.bannerOpacity !== undefined ? (1 - (titleStyle.bannerOpacity as number)) * 0.3 : 0})`,
              pointerEvents: 'none',
            }}
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
                {siteConfig?.siteName || '我的空间'}
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
            {siteConfig?.siteName || '我的空间'}
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
            <Col xs={24} sm={Math.floor(24 / moduleCount)} key={card.key}>
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
      </div>
    </div>
  );
};

export default HomePage;

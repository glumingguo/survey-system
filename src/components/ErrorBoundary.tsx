import React from 'react';

interface State {
  hasError: boolean;
  error?: Error;
  info?: React.ErrorInfo;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] 组件崩溃:', error);
    console.error('[ErrorBoundary] 组件栈:', info.componentStack);
    this.setState({ error, info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, background: '#fff1f0', border: '1px solid #ffa39e', borderRadius: 4, margin: 24 }}>
          <h2 style={{ color: '#cf1322' }}>❌ 页面渲染出错</h2>
          <p><b>错误信息：</b> {this.state.error?.message}</p>
          <details>
            <summary>详细错误栈（点击展开）</summary>
            <pre style={{ fontSize: 12, overflow: 'auto', maxHeight: 400 }}>
              {this.state.error?.stack}
            </pre>
            <pre style={{ fontSize: 12, overflow: 'auto', maxHeight: 400 }}>
              {this.state.info?.componentStack}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

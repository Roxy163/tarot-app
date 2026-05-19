import React, { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-forest-bg flex flex-col items-center justify-center p-6">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-6">
            <AlertCircle className="text-red-500" size={40} />
          </div>
          <h2 className="text-2xl font-serif font-bold text-forest-ink mb-2">页面出错了</h2>
          <p className="text-forest-muted text-center mb-6 max-w-md">
            抱歉，页面出现了意外错误。请尝试刷新页面或返回首页。
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-6 py-3 bg-forest-accent text-white rounded-xl font-bold text-sm hover:bg-forest-accent/90 transition-colors"
            >
              <RefreshCw size={16} />
              <span>刷新页面</span>
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="flex items-center gap-2 px-6 py-3 bg-white text-forest-accent rounded-xl font-bold text-sm border border-forest-accent/20 hover:bg-forest-accent/5 transition-colors"
            >
              <Home size={16} />
              <span>返回首页</span>
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div className="mt-8 p-4 bg-forest-bg/50 rounded-xl max-w-md text-left">
              <p className="text-xs text-forest-muted font-bold mb-2">错误信息（开发环境）</p>
              <pre className="text-xs text-forest-text/60 whitespace-pre-wrap font-mono">
                {this.state.error.message}
              </pre>
              {this.state.errorInfo && (
                <pre className="text-xs text-forest-muted/60 whitespace-pre-wrap font-mono mt-2">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

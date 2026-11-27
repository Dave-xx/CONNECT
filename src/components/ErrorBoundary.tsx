import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('Application ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      let friendly = 'Something went wrong while loading this section.';
      if (this.state.message.includes('permission') || this.state.message.includes('PERMISSION_DENIED')) {
        friendly = 'You do not have permission to access this resource, or your session needs to be refreshed.';
      }
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6 bg-[#F7F9FC]">
          <div className="max-w-md w-full bg-white border border-[#E6EAF0] rounded-2xl p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#DC5353]/10 text-[#DC5353] flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-[#132238] mb-2">Unable to complete request</h2>
            <p className="text-sm text-[#667085] mb-6">{friendly}</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, message: '' });
                window.location.href = '/';
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0D9488] text-white text-sm font-medium hover:bg-[#0F766E] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Return Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

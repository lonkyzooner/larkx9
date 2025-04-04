import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onMirandaError?: (error: Error) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Specialized error boundary for Miranda rights functionality
 * Catches errors related to Miranda rights processing and provides recovery options
 */
class MirandaErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { 
      hasError: true,
      error 
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Miranda functionality error:', error);
    console.error('Component stack:', errorInfo.componentStack);
    
    // Notify parent component about the error
    if (this.props.onMirandaError) {
      this.props.onMirandaError(error);
    }
    
    // Set user-friendly error message
    this.setState({
      hasError: true,
      error: new Error('An error occurred while processing Miranda rights. Please try again later.')
    });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-4 border border-amber-300 bg-amber-50 rounded-md">
          <h2 className="text-lg font-semibold text-amber-700 mb-2">Miranda Rights Error</h2>
          <p className="text-amber-600 mb-2">{this.state.error?.message}</p>
          <div className="flex space-x-2">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => {
                try {
                  const mirandaTabTrigger = document.querySelector('[value="miranda"]') as HTMLElement;
                  if (mirandaTabTrigger) {
                    mirandaTabTrigger.click();
                  }
                } catch (error) {
                  console.error('Error clicking Miranda tab:', error);
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Go to Miranda Tab
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default MirandaErrorBoundary;

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';
import { Button } from '../ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React component tree:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-text flex items-center justify-center p-4 sm:p-6">
          <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl border border-border bg-surface shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-danger-muted text-danger flex items-center justify-center mx-auto border border-danger/20">
              <AlertOctagon className="w-7 h-7" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-text">Something went wrong</h2>
              <p className="text-xs text-secondary leading-relaxed">
                An unexpected UI rendering error occurred. You can attempt to refresh the page or recover your session.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-xl bg-border-subtle border border-border text-left font-mono text-[11px] text-danger overflow-x-auto max-h-32">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
              <Button variant="primary" size="md" className="w-full justify-center" onClick={this.handleReload}>
                <RotateCcw className="w-4 h-4" />
                <span>Reload Application</span>
              </Button>
              <Button variant="secondary" size="md" className="w-full justify-center" onClick={this.handleReset}>
                <span>Try to Recover</span>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

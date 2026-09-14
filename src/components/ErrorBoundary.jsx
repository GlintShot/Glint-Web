import { Component } from 'react';
import { StatusScreen } from '../pages/NotFound';

/**
 * Catches render crashes and shows a Glint-styled recovery screen
 * instead of a blank React error overlay in production.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Glint Studio crash:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const detail =
      import.meta.env.DEV && error?.message
        ? String(error.message)
        : 'Something broke while rendering. Reload to continue, or head home.';

    return (
      <StatusScreen
        code="500"
        title="Studio hit a snag"
        detail={detail}
        primaryLabel="Reload"
        onPrimary={() => window.location.reload()}
        secondaryLabel="Back to Studio"
        onSecondary={() => {
          window.location.href = '/';
        }}
      />
    );
  }
}

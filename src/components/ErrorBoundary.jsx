import { Component } from 'react';
import { Link } from 'react-router-dom';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            The page failed to load. This can happen after a site update if your browser or installed app
            is still using an older cached version.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Reload page
            </button>
            <Link
              to="/"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Go to homepage
            </Link>
          </div>
          {import.meta.env.DEV ? (
            <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs text-red-200">
              {error instanceof Error ? error.message : String(error)}
            </pre>
          ) : null}
        </div>
      </div>
    );
  }
}

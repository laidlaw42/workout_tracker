import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  /** Where "Go home" should send the user (default '/'). */
  homeHref?: string
}

interface State {
  error: Error | null
}

// App-wide safety net: a render error in any screen would otherwise unmount the
// whole tree and leave a blank white screen. This catches it and shows a
// recovery card instead. Logged workout data lives in IndexedDB (written
// immediately, A48), so a crash never loses it — reloading resumes cleanly.
//
// A class component is required: there is no hook equivalent of
// getDerivedStateFromError / componentDidCatch.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mx-auto max-w-xs text-sm text-muted-foreground">
            The screen hit an unexpected error. Your logged data is saved — reloading will pick up
            where you left off.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button
            variant="outline"
            onClick={() => {
              // Full navigation (not client-side) so a corrupted router/screen
              // state is fully reset.
              window.location.href = this.props.homeHref ?? import.meta.env.BASE_URL
            }}
          >
            Go home
          </Button>
        </div>
      </div>
    )
  }
}

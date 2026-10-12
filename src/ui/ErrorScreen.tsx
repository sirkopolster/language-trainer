import { Component, type ReactNode } from 'react';
import { useRouteError } from 'react-router-dom';
import { Button, Card, EmptyState } from './ds';

function Friendly({ detail }: { detail?: string }) {
  return (
    <main className="page" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <Card flat>
        <EmptyState icon="😵" title="Da ist etwas schiefgelaufen" text={detail ?? 'Bitte neu laden. Wenn es bleibt, sag Sirko Bescheid.'} action={<Button onClick={() => location.reload()}>Neu laden</Button>} />
      </Card>
    </main>
  );
}

export function RouteError() {
  const e = useRouteError() as { statusText?: string; message?: string } | undefined;
  return <Friendly detail={e?.statusText ?? e?.message} />;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() { return this.state.error ? <Friendly detail={this.state.error.message} /> : this.props.children; }
}

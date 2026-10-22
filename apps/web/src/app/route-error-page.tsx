import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";

export function RouteErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status}: ${error.statusText}`
    : "An unexpected routing error occurred.";

  return (
    <main className="standalone-state">
      <section className="state-card" role="alert">
        <p className="eyebrow">Navigation error</p>
        <h1>We could not load this view</h1>
        <p className="muted">{message}</p>
        <Link className="button button-primary" to="/">
          Return home
        </Link>
      </section>
    </main>
  );
}

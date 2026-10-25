import { Link, useLocation } from "react-router-dom";

export function NotFoundPage() {
  const location = useLocation();

  return (
    <main className="standalone-state">
      <section className="state-card" role="status">
        <p className="eyebrow">404 · View not found</p>
        <h1>That ReleaseArc view does not exist.</h1>
        <p className="muted">
          We could not find <code>{location.pathname}</code>. Use the link below
          to return to a known workspace.
        </p>
        <Link className="button button-primary" to="/">
          Return home
        </Link>
      </section>
    </main>
  );
}

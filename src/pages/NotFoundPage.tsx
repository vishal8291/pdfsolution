import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="not-found-page">
      <div className="container not-found-inner">
        <div className="not-found-num">404</div>
        <h1>Page not found</h1>
        <p>The page you're looking for doesn't exist or has been moved.</p>
        <div className="not-found-actions">
          <Link to="/" className="btn btn-primary">Go to Home</Link>
          <Link to="/tools" className="btn btn-outline">Use PDF Tools</Link>
        </div>
      </div>
    </main>
  );
}

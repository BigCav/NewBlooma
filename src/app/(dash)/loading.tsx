/** Shown the instant a link is tapped, while the next page loads. Grey placeholders in the shape of a page. */
export default function Loading() {
  return (
    <div className="sk-page" role="status" aria-busy="true" aria-label="Loading">
      <div className="sk sk-title" />
      <div className="sk sk-sub" />
      <div className="sk-row"><div className="sk sk-stat" /><div className="sk sk-stat" /></div>
      <div className="sk sk-pill" />
      {[0, 1, 2, 3, 4].map((i) => <div key={i} className="sk sk-card" />)}
    </div>
  );
}

export default function FeedbackAnnouncements({ items = [] }) {
    if (!items.length) return null;
    return (
      <div className="feedback-announcements">
        <div className="title">Eventos:</div>
        <ul className="list">
          {items.map((m, i) => <li key={i}>{m}</li>)}
        </ul>
      </div>
    );
  }
  
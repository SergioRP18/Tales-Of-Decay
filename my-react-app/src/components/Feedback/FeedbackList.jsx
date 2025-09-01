export default function FeedbackList({ label, people = [] }) {
    if (!people.length) return null;
    return (
      <div className="feedback-list">
        <span className="label">{label}: </span>
        <span className="names">
          {people.map(p => p.name ?? p.uid).join(", ")}
        </span>
      </div>
    );
  }
  
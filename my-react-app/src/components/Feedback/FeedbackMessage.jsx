export default function FeedbackMessage({ text }) {
    if (!text) return null;
    return <p className="feedback-text">{text}</p>;
  }
  
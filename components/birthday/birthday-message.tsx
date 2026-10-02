export default function BirthdayMessage({ message }: { message: string }) {
  return (
    <section className="bp-card bp-reveal bp-d2" aria-label="Your message">
      <span className="bp-label">A message for you</span>
      <p className="bp-message">{message}</p>
    </section>
  );
}

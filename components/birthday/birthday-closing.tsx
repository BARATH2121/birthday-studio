export default function BirthdayClosing({ name }: { name: string }) {
  return (
    <footer className="bp-closing bp-fade bp-d4">
      <span className="bp-closing-rule" aria-hidden="true" />
      <p className="bp-closing-text">
        Made with love for <span className="bp-closing-name">{name}</span>
      </p>
    </footer>
  );
}

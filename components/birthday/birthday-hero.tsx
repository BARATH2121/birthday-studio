export default function BirthdayHero({
  name,
  relationshipLine,
  emoji,
}: {
  name: string;
  relationshipLine: string;
  emoji: string;
}) {
  return (
    <header className="bp-hero">
      <span className="bp-kicker bp-fade">Happy Birthday</span>
      <h2 className="bp-name bp-rise bp-d1">
        {name}
        <span className="bp-name-emoji bp-sway" aria-hidden="true">
          {emoji}
        </span>
      </h2>
      <p className="bp-rel bp-rise bp-d2">{relationshipLine}</p>
    </header>
  );
}

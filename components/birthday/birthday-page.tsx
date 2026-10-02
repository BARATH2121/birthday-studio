import { relationshipPhrase, type BirthdayDraft } from "@/lib/birthday";
import BirthdayAudioPlayer from "./birthday-audio-player";
import BirthdayClosing from "./birthday-closing";
import BirthdayDecorations from "./birthday-decorations";
import BirthdayGallery from "./birthday-gallery";
import BirthdayHero from "./birthday-hero";
import BirthdayMessage from "./birthday-message";
import BirthdayScene from "./birthday-scene";
import { themeFor } from "./style-theme";

export default function BirthdayPage({ draft }: { draft: BirthdayDraft }) {
  const theme = themeFor(draft.style);
  const name = draft.birthdayPersonName.trim();
  const message = draft.message.trim();

  return (
    <article
      className="bp"
      data-bstyle={theme.id}
      data-bmotion={theme.motion}
      aria-label={`${theme.name} birthday preview for ${name}`}
    >
      <BirthdayDecorations kind={theme.decorations} />
      <BirthdayScene
        key={theme.scene.kind}
        scene={theme.scene}
      />

      <div className="bp-inner">
        <BirthdayHero
          name={name}
          relationshipLine={relationshipPhrase(draft.relationship)}
          emoji={theme.emoji}
        />

        <div className="mt-8 space-y-6 sm:mt-10 sm:space-y-8">
          <BirthdayMessage message={message} />
          <BirthdayGallery photos={draft.photos} emoji={theme.emoji} />
        </div>

        <BirthdayClosing name={name} />

        <p className="bp-meta">{theme.name} style</p>
      </div>

      {/*
        Fixed to the corner rather than placed in the hero or the message. Every
        other section of this page is centred and vertically stacked, so any
        in-flow position for a control would either shift the composition or sit
        where it competes with the text. Out of flow, it also survives the long
        scroll on a page with twenty photos.
      */}
      {draft.audio ? (
        <div className="pointer-events-none fixed bottom-4 right-4 z-20">
          <div className="pointer-events-auto">
            <BirthdayAudioPlayer src={draft.audio.url} title={`Music for ${name}`} />
          </div>
        </div>
      ) : null}
    </article>
  );
}

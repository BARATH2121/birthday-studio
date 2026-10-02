import { SelectField, TextAreaField, TextField } from "./field";
import {
  FIELD_IDS,
  MESSAGE_MAX_LENGTH,
  MONTH_OPTIONS,
  RELATIONSHIPS,
  birthdayDayOptions,
  formatBirthdayDate,
  type BirthdayDraft,
  type BirthdayMonth,
  type FieldName,
} from "@/lib/birthday";

type StepDetailsProps = {
  draft: BirthdayDraft;
  errors: Partial<Record<FieldName, string>>;
  onChange: (values: Partial<BirthdayDraft>) => void;
  onBlur: (field: FieldName) => void;
};

export default function StepDetails({
  draft,
  errors,
  onChange,
  onBlur,
}: StepDetailsProps) {
  const used = draft.message.length;
  const nearLimit = used >= MESSAGE_MAX_LENGTH - 40;

  // Selecting a shorter month has to shrink the day list, or the draft keeps a
  // day that month no longer has — "31 March" would survive the change and only
  // be rejected on submit. Clearing instead of silently truncating avoids
  // quietly replacing a choice the person did not make.
  const dayOptions = birthdayDayOptions(draft.birthdayMonth);

  const chooseMonth = (value: string) => {
    const month: BirthdayMonth | "" = value === "" ? "" : (Number(value) as BirthdayMonth);
    const keepDay = birthdayDayOptions(month).includes(
      draft.birthdayDay === "" ? -1 : draft.birthdayDay,
    );

    onChange({
      birthdayMonth: month,
      ...(keepDay ? {} : { birthdayDay: "" }),
    });
  };

  const birthdayHint =
    draft.birthdayMonth !== "" && draft.birthdayDay !== ""
      ? `Their page closes at midnight on ${formatBirthdayDate(
          draft.birthdayDay,
          draft.birthdayMonth,
        )}, and this link stops working for everyone.`
      : "The page works until the end of the day of their birthday, then it closes everywhere.";

  return (
    <div className="grid gap-6">
      <TextField
        id={FIELD_IDS.birthdayPersonName}
        label="Name"
        value={draft.birthdayPersonName}
        onChange={(value) => onChange({ birthdayPersonName: value })}
        onBlur={() => onBlur("birthdayPersonName")}
        error={errors.birthdayPersonName}
        placeholder="Their name"
        autoComplete="off"
      />

      <SelectField
        id={FIELD_IDS.relationship}
        label="Relationship"
        value={draft.relationship}
        onChange={(value) => onChange({ relationship: value as BirthdayDraft["relationship"] })}
        onBlur={() => onBlur("relationship")}
        error={errors.relationship}
        options={RELATIONSHIPS}
      />

      <div>
        <p className="bs-label">Birthday</p>
        {/* Month first, then day: the day list is length-dependent, so reading
            order has to match that or the control appears before it has content. */}
        <div className="mt-2 grid grid-cols-2 gap-3">
          <SelectField
            id={FIELD_IDS.birthdayMonth}
            label="Month"
            // Visually hidden label. The group above already says "Birthday", and
            // two more visible labels would repeat it three times over. The
            // element keeps its own name so the error association still works.
            hideLabel
            value={draft.birthdayMonth === null ? "" : String(draft.birthdayMonth)}
            onChange={chooseMonth}
            onBlur={() => onBlur("birthdayMonth")}
            error={errors.birthdayMonth}
            options={MONTH_OPTIONS}
            placeholder="Month"
          />

          <SelectField
            id={FIELD_IDS.birthdayDay}
            label="Day"
            hideLabel
            value={draft.birthdayDay === "" ? "" : String(draft.birthdayDay)}
            onChange={(value) =>
              onChange({ birthdayDay: value === "" ? "" : Number(value) })
            }
            onBlur={() => onBlur("birthdayDay")}
            error={errors.birthdayDay}
            options={dayOptions.map(String)}
            placeholder="Day"
          />
        </div>

        <p className="bs-hint mt-2">{birthdayHint}</p>
      </div>

      <TextAreaField
        id={FIELD_IDS.message}
        label="Birthday message"
        value={draft.message}
        onChange={(value) => onChange({ message: value })}
        onBlur={() => onBlur("message")}
        error={errors.message}
        placeholder="Write something they'd love reading on their birthday."
        maxLength={MESSAGE_MAX_LENGTH}
        counter={
          <span
            className={`text-xs tabular-nums ${
              nearLimit ? "text-blush-300" : "text-white/45"
            }`}
          >
            {used} / {MESSAGE_MAX_LENGTH}
          </span>
        }
      />
    </div>
  );
}

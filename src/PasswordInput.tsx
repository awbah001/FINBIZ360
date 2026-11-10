import { useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeSlash as EyeOff } from "@phosphor-icons/react";
import "./password-input.css";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  visibilityLabel?: string;
};

export default function PasswordInput({
  id,
  type: _type,
  visibilityLabel = "password",
  ...props
}: Props) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [visible, setVisible] = useState(false);
  return (
    <>
      <input {...props} id={inputId} type={visible ? "text" : "password"} />
      <button
        type="button"
        className="password-visibility"
        aria-label={`${visible ? "Hide" : "Show"} ${visibilityLabel}`}
        aria-controls={inputId}
        aria-pressed={visible}
        disabled={props.disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? (
          <EyeOff size={18} aria-hidden="true" focusable="false" />
        ) : (
          <Eye size={18} aria-hidden="true" focusable="false" />
        )}
      </button>
    </>
  );
}

// Shared schema-driven forms retain native inputs for all other field types.
export function FormInput({ visibilityLabel, ...props }: Props) {
  return props.type === "password" ? (
    <PasswordInput {...props} visibilityLabel={visibilityLabel} />
  ) : (
    <input {...props} />
  );
}

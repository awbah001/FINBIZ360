import { useEffect, useRef, useState } from "react";
import {
  Camera,
  FloppyDisk as Save,
  Trash as Trash2,
  X,
} from "@phosphor-icons/react";
import UserAvatar from "./UserAvatar";

export type ProfileUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  image_url?: string | null;
};

async function preparePhoto(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPG, PNG or WebP image.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Choose an image no larger than 10 MB.");
  const image = await createImageBitmap(file);
  try {
    if (
      !image.width ||
      !image.height ||
      image.width * image.height > 40_000_000
    )
      throw new Error("Choose an image smaller than 40 megapixels.");
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 512 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Image processing is unavailable in this browser.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob && blob.size <= 1024 * 1024
            ? resolve(blob)
            : reject(
                new Error(
                  "This image could not be prepared. Try a smaller photo.",
                ),
              ),
        "image/png",
      ),
    );
  } finally {
    image.close();
  }
}

export default function ProfilePhoto({
  user,
  onSave,
}: {
  user: ProfileUser;
  onSave: (image: Blob | null) => Promise<void>;
}) {
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pending = useRef(false);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!photo) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  async function save(image: Blob | null) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await onSave(image);
      setPhoto(null);
      setMessage(image ? "Profile photo saved." : "Profile photo removed.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Your photo could not be saved.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="profile-photo-editor" aria-busy={busy}>
      <UserAvatar
        className="profile-avatar"
        name={user.name}
        src={preview || user.image_url}
      />
      <input
        ref={picker}
        type="file"
        className="profile-photo-input"
        aria-label="Choose profile photo"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file || pending.current) return;
          pending.current = true;
          setBusy(true);
          setError("");
          setMessage("");
          try {
            setPhoto(await preparePhoto(file));
          } catch (err) {
            setError(
              err instanceof Error && err.message
                ? err.message
                : "This image could not be opened. Choose another photo.",
            );
          } finally {
            pending.current = false;
            setBusy(false);
          }
        }}
      />
      <div className="profile-photo-actions">
        <button
          type="button"
          className="button secondary small"
          disabled={busy}
          onClick={() => picker.current?.click()}
        >
          <Camera size={15} aria-hidden="true" focusable="false" />
          {user.image_url || photo ? "Change photo" : "Add photo"}
        </button>
        {photo ? (
          <>
            <button
              type="button"
              className="button small"
              disabled={busy}
              onClick={() => save(photo)}
            >
              <Save size={15} aria-hidden="true" focusable="false" />
              {busy ? "Please wait…" : "Save photo"}
            </button>
            <button
              type="button"
              className="button secondary small"
              disabled={busy}
              onClick={() => {
                setPhoto(null);
                setError("");
              }}
            >
              <X size={15} aria-hidden="true" focusable="false" />
              Cancel
            </button>
          </>
        ) : (
          user.image_url && (
            <button
              type="button"
              className="button secondary small"
              disabled={busy}
              onClick={() => save(null)}
            >
              <Trash2 size={15} aria-hidden="true" focusable="false" />
              Remove photo
            </button>
          )
        )}
      </div>
      <p className="profile-photo-help">
        JPG, PNG or WebP, up to 10 MB. Photos are resized before saving.
        {photo && " Preview only — select Save photo to keep it."}
      </p>
      {error && (
        <p className="profile-photo-error" role="alert">
          {error}
        </p>
      )}
      <p className="profile-photo-status" role="status">
        {busy ? "Preparing or saving photo…" : message}
      </p>
    </div>
  );
}

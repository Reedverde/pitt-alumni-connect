import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import {
  assignPhotoSlot,
  getPhotoLibrary,
  removePhoto,
  updatePhotoAlt,
  updatePhotoBoardYear,
} from "@/lib/photos.functions";
import { SLOT_LABELS, photoUrl } from "@/lib/photo-slots";
import { Section, hairline, inputStyle, mono, primaryButton, secondaryButton } from "./ui";

const ACCEPT = "image/jpeg,image/png,image/webp";

type Progress = { name: string; pct: number; error?: string; done?: boolean };

async function readDimensions(file: File) {
  return new Promise<{ width: number | null; height: number | null }>((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: null, height: null });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export function PhotosPanel() {
  const queryClient = useQueryClient();
  const fetchLibrary = useServerFn(getPhotoLibrary);
  const saveAlt = useServerFn(updatePhotoAlt);
  const saveYear = useServerFn(updatePhotoBoardYear);
  const assign = useServerFn(assignPhotoSlot);
  const destroy = useServerFn(removePhoto);

  const { data } = useQuery({ queryKey: ["photo-library"], queryFn: () => fetchLibrary({}) });
  const [progress, setProgress] = useState<Progress[]>([]);
  const [dragging, setDragging] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["photo-library"] });
    queryClient.invalidateQueries({ queryKey: ["photo-slots"] });
  };

  const uploadOne = useCallback(
    async (file: File, index: number) => {
      const set = (patch: Partial<Progress>) =>
        setProgress((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

      if (file.size > 10 * 1024 * 1024) {
        set({ error: "Larger than 10MB." });
        return;
      }
      const { width, height } = await readDimensions(file);
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        set({ error: "Session expired. Sign in again." });
        return;
      }

      const form = new FormData();
      form.append("file", file);
      if (width) form.append("width", String(width));
      if (height) form.append("height", String(height));

      await new Promise<void>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/photos/upload");
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) set({ pct: Math.round((e.loaded / e.total) * 100) });
        };
        xhr.onload = () => {
          try {
            const body = JSON.parse(xhr.responseText);
            if (body.ok) set({ pct: 100, done: true });
            else set({ error: body.error ?? "Rejected." });
          } catch {
            set({ error: xhr.status === 403 ? "Not allowed." : "Upload failed." });
          }
          resolve();
        };
        xhr.onerror = () => {
          set({ error: "Upload failed." });
          resolve();
        };
        xhr.send(form);
      });
    },
    [],
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const list = Array.from(files);
      const base = progress.length;
      setProgress((rows) => [...rows, ...list.map((f) => ({ name: f.name, pct: 0 }))]);
      for (let i = 0; i < list.length; i += 1) await uploadOne(list[i], base + i);
      refresh();
    },
    [progress.length, uploadOne],
  );

  if (!data?.isAdmin) return null;

  const photos = data.photos;
  const slots = data.slots;
  const untagged = photos.filter((p) => p.board_year === null).length;

  return (
    <Section eyebrow="Photographs" title="Upload and assign">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        style={{
          border: `1.5px dashed ${dragging ? "var(--pitt-royal)" : "var(--chalk)"}`,
          borderRadius: 7,
          background: dragging ? "var(--concrete)" : "transparent",
          padding: "26px 18px",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 13, color: "var(--steel-ink)" }}>
          Drop JPEG, PNG or WebP files here. 10MB each.
        </p>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button type="button" style={{ ...primaryButton, marginTop: 12 }} onClick={() => fileInput.current?.click()}>
          Choose files
        </button>
      </div>

      {progress.length > 0 && (
        <ul className="mt-4" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {progress.map((row, i) => (
            <li key={`${row.name}-${i}`} style={{ borderTop: hairline, padding: "8px 0" }}>
              <div className="flex items-center justify-between gap-3">
                <span style={{ ...mono, fontSize: 12 }}>{row.name}</span>
                <span style={{ fontSize: 12, color: row.error ? "var(--pitt-royal)" : "var(--sterling)" }}>
                  {row.error ? row.error : row.done ? "Uploaded" : `${row.pct}%`}
                </span>
              </div>
              {!row.error && (
                <div style={{ height: 3, background: "var(--concrete)", marginTop: 6 }}>
                  <div style={{ height: 3, width: `${row.pct}%`, background: "var(--pitt-royal)" }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-10" style={{ ...mono, fontSize: 12, color: "var(--sterling)" }}>
        LIBRARY ({photos.length})
      </h3>
      <p style={{ fontSize: 13, color: untagged > 0 ? "var(--pitt-royal)" : "var(--sterling)" }}>
        {untagged === 0
          ? "Every photograph has a year."
          : `${untagged} of ${photos.length} photographs have no year and stay off the board.`}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p) => (
          <div key={p.id} style={{ border: hairline, borderRadius: 7, padding: 8 }}>
            <img
              src={photoUrl(p.storage_path)}
              alt={p.alt || p.original_name || "Uploaded photograph"}
              loading="lazy"
              style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 4 }}
            />
            <p className="mt-2" style={{ ...mono, fontSize: 11, wordBreak: "break-all" }}>
              {p.original_name}
            </p>
            <p style={{ ...mono, fontSize: 11, color: "var(--sterling)" }}>
              {p.width ?? "?"}×{p.height ?? "?"}
            </p>
            <input
              defaultValue={p.alt ?? ""}
              placeholder="Alt text"
              style={{ ...inputStyle, marginTop: 6 }}
              onBlur={async (e) => {
                if (e.target.value === (p.alt ?? "")) return;
                await saveAlt({ data: { photoId: p.id, alt: e.target.value } });
                refresh();
              }}
            />
            <input
              type="number"
              defaultValue={p.board_year ?? ""}
              placeholder="Board year"
              style={{ ...inputStyle, marginTop: 6 }}
              onBlur={async (e) => {
                const raw = e.target.value.trim();
                const next = raw === "" ? null : Number(raw);
                if ((next ?? null) === (p.board_year ?? null)) return;
                await saveYear({ data: { photoId: p.id, year: next } });
                refresh();
              }}
            />
            {confirmId === p.id ? (
              <div className="mt-2">
                <input
                  autoFocus
                  value={confirmText}
                  placeholder='Type DELETE'
                  style={inputStyle}
                  onChange={(e) => setConfirmText(e.target.value)}
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    style={primaryButton}
                    disabled={confirmText !== "DELETE"}
                    onClick={async () => {
                      const res = await destroy({ data: { photoId: p.id } });
                      if (!res.ok) setDeleteError(res.error ?? "Refused.");
                      else {
                        setDeleteError(null);
                        setConfirmId(null);
                        setConfirmText("");
                        refresh();
                      }
                    }}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    style={secondaryButton}
                    onClick={() => {
                      setConfirmId(null);
                      setConfirmText("");
                      setDeleteError(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
                {deleteError && (
                  <p className="mt-2" style={{ fontSize: 12, color: "var(--pitt-royal)" }}>
                    {deleteError}
                  </p>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="mt-2"
                style={secondaryButton}
                onClick={() => {
                  setConfirmId(p.id);
                  setConfirmText("");
                  setDeleteError(null);
                }}
              >
                Delete
              </button>
            )}
          </div>
        ))}
        {photos.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--sterling)" }}>Nothing uploaded yet.</p>
        )}
      </div>

      <h3 className="mt-10" style={{ ...mono, fontSize: 12, color: "var(--sterling)" }}>
        SLOTS
      </h3>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((slot) => (
          <div key={slot.key} style={{ border: hairline, borderRadius: 7, padding: 10 }}>
            <p style={{ fontSize: 13, color: "var(--sabah-black)", fontWeight: 600 }}>
              {SLOT_LABELS[slot.key] ?? slot.key}
            </p>
            <p style={{ ...mono, fontSize: 11, color: "var(--sterling)" }}>{slot.key}</p>
            <div
              className="mt-2"
              style={{
                aspectRatio: "16 / 9",
                background: "var(--concrete)",
                border: slot.photo ? "none" : "1.5px dashed var(--chalk)",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              {slot.photo && (
                <img
                  src={photoUrl(slot.photo.storage_path)}
                  alt={slot.photo.alt || SLOT_LABELS[slot.key] || slot.key}
                  loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}
            </div>
            <select
              className="mt-2"
              value={slot.photo_id ?? ""}
              style={inputStyle}
              onChange={async (e) => {
                await assign({ data: { key: slot.key, photoId: e.target.value || null } });
                refresh();
              }}
            >
              <option value="">Empty</option>
              {photos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.original_name ?? p.storage_path}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </Section>
  );
}

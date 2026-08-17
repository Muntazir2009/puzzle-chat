"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, User, Check, Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ProfileDialogProps {
  userId: string;
  userName: string;
  userAvatar: string | null;
  userEmail: string | null;
  onNameChange: (newName: string) => void;
  onAvatarChange: (newAvatarUrl: string) => void;
}

type UserOnlineStatus = {
  online: boolean;
  last_seen: string;
};

export function ProfileDialog({
  userId,
  userName,
  userAvatar,
  userEmail,
  onNameChange,
  onAvatarChange,
}: ProfileDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(userName);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  /* Avatar upload state */
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState(false);
  const [avatarHovered, setAvatarHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevAvatarUrlRef = useRef<string | null>(null);

  /* Status state */
  const [userStatus, setUserStatus] = useState<UserOnlineStatus | null>(null);

  /* The displayed avatar: preview takes priority, then the prop */
  const displayedAvatar = avatarPreview ?? userAvatar;

  /* Reset preview when prop avatar changes (after successful upload) */
  useEffect(() => {
    if (prevAvatarUrlRef.current !== userAvatar) {
      setAvatarPreview(null);
      prevAvatarUrlRef.current = userAvatar;
    }
  }, [userAvatar]);

  const handleOpen = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setName(userName);
        setSuccess(false);
        setAvatarPreview(null);
        setAvatarSuccess(false);
        setAvatarHovered(false);

        /* Fetch user's online status */
        fetch("/api/users/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_ids: [userId] }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data?.[userId]) {
              setUserStatus(data[userId]);
            }
          })
          .catch(() => {});
      } else {
        /* Cleanup preview object URL on close */
        setAvatarPreview(null);
        setAvatarHovered(false);
      }
      setOpen(isOpen);
    },
    [userName, userId]
  );

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === userName) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        setSuccess(true);
        onNameChange(trimmed);
        setTimeout(() => setOpen(false), 600);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [name, userName, onNameChange]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      /* Validate file type */
      const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowed.includes(file.type)) {
        toast({
          title: "Invalid file",
          description: "Please select a JPEG, PNG, GIF, or WebP image.",
          variant: "destructive",
        });
        return;
      }

      /* Validate file size (2 MB) */
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Avatar must be smaller than 2 MB.",
          variant: "destructive",
        });
        return;
      }

      /* Show immediate preview */
      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);
      setAvatarSuccess(false);
      setUploading(true);

      try {
        const formData = new FormData();
        formData.append("avatar", file);

        const res = await fetch("/api/users/profile", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          setAvatarSuccess(true);
          onAvatarChange(data.avatar_url);
          toast({
            title: "Avatar updated",
            description: "Your profile picture has been changed.",
          });
        } else {
          const errData = await res.json().catch(() => null);
          toast({
            title: "Upload failed",
            description: errData?.error ?? "Something went wrong. Please try again.",
            variant: "destructive",
          });
          setAvatarPreview(null);
        }
      } catch (err) {
        console.error(err);
        toast({
          title: "Upload failed",
          description: "Network error. Please try again.",
          variant: "destructive",
        });
        setAvatarPreview(null);
      } finally {
        setUploading(false);
        /* Reset file input so the same file can be re-selected */
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [onAvatarChange]
  );

  const userInitials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <div className="cursor-pointer rounded-lg px-2 py-1.5 transition-colors hover:bg-muted">
          <User className="mr-2 inline size-4" />
          Edit profile
        </div>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm gap-0 p-0 overflow-hidden rounded-2xl" aria-describedby={undefined}>
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-base font-semibold">Edit Profile</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6">
          {/* Avatar preview with upload overlay */}
          <div className="mb-6 flex flex-col items-center gap-3">
            <div className="relative">
              {/* Outer clickable container sized to fit avatar + ring */}
              <div
                className="relative cursor-pointer"
                style={{ width: 96, height: 96 }}
                onMouseEnter={() => setAvatarHovered(true)}
                onMouseLeave={() => setAvatarHovered(false)}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Upload avatar"
              >
                <div className="absolute inset-2">
                  <Avatar className="size-full ring-4 transition-all duration-300" style={{ "--tw-ring-color": "var(--app-accent-lighter)" } as React.CSSProperties}>
                    <AvatarImage
                      src={displayedAvatar ?? undefined}
                      alt={userName}
                      className="transition-opacity duration-500"
                    />
                    <AvatarFallback
                      className="text-xl font-bold text-white transition-all duration-300"
                      style={{ background: "linear-gradient(to bottom right, var(--app-accent-from), var(--app-accent-to))" }}
                    >
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </div>

                {/* Hover / uploading overlay */}
                <div
                  className={cn(
                    "absolute inset-2 z-10 flex items-center justify-center rounded-full transition-opacity duration-200",
                    (avatarHovered || uploading)
                      ? "bg-black/40 opacity-100"
                      : "bg-black/40 opacity-0 pointer-events-none"
                  )}
                  aria-hidden
                >
                  <div
                    className={cn(
                      "flex size-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-white shadow-lg transition-transform duration-200",
                      (avatarHovered && !uploading) && "scale-100",
                      uploading && "scale-90"
                    )}
                    style={{ background: "var(--app-accent)" }}
                  >
                    {uploading ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : avatarSuccess ? (
                      <Check className="size-5" strokeWidth={3} />
                    ) : (
                      <Camera className="size-5" />
                    )}
                  </div>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>
            {userEmail && (
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            )}
          </div>

          {/* Name input */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Display name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="Your name"
              maxLength={50}
              className="h-11 rounded-xl"
              style={{ "--tw-ring-color": "var(--app-accent-ring)" } as React.CSSProperties}
              autoFocus
            />

            {/* Online status */}
            {userStatus && (
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-block size-2 rounded-full transition-colors duration-300",
                    userStatus.online
                      ? "bg-emerald-500"
                      : "bg-zinc-400 dark:bg-zinc-600"
                  )}
                />
                <span className="text-xs text-muted-foreground">
                  {userStatus.online ? "Online" : "Offline"}
                </span>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              This is how you appear to others in conversations.
            </p>
          </div>

          {/* Save button */}
          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="rounded-xl"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !name.trim() || name.trim() === userName}
              className="rounded-xl text-white transition-opacity hover:opacity-90"
              style={{
                background: "linear-gradient(to right, var(--app-accent-from), var(--app-accent-to))",
              }}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : success ? (
                <Check className="size-4" />
              ) : null}
              {success ? "Saved" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

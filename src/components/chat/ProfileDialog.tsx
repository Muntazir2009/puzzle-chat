"use client";

import { useCallback, useState } from "react";
import { Loader2, User, Check } from "lucide-react";
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

interface ProfileDialogProps {
  userId: string;
  userName: string;
  userAvatar: string | null;
  userEmail: string | null;
  onNameChange: (newName: string) => void;
}

export function ProfileDialog({
  userId,
  userName,
  userAvatar,
  userEmail,
  onNameChange,
}: ProfileDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(userName);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleOpen = useCallback(
    (isOpen: boolean) => {
      if (isOpen) {
        setName(userName);
        setSuccess(false);
      }
      setOpen(isOpen);
    },
    [userName]
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
      <DialogContent className="sm:max-w-sm gap-0 p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-base font-semibold">Edit Profile</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6">
          {/* Avatar preview */}
          <div className="mb-6 flex flex-col items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-1.5 rounded-full bg-gradient-to-br from-violet-500/30 to-purple-600/30 blur-md" />
              <Avatar className="relative size-20 ring-4 ring-violet-100 dark:ring-violet-900/50">
                {userAvatar && <AvatarImage src={userAvatar} alt={userName} />}
                <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-xl font-bold text-white">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
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
              autoFocus
            />
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
              className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 shadow-md shadow-violet-500/20 hover:from-violet-600 hover:to-purple-700"
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

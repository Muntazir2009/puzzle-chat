import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().min(1).max(50).trim(),
});

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export async function PUT(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = profileSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Name must be 1-50 characters" },
        { status: 422 }
      );
    }

    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("users")
      .update({ name: parsed.data.name })
      .eq("id", authUser.id)
      .select("id, name, avatar_url")
      .single();

    if (error) {
      console.error("[users/profile] update error:", error);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[users/profile] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users/profile
 *
 * Accepts multipart/form-data with an `avatar` file field.
 * Uploads to Supabase Storage (avatars bucket) and updates user's avatar_url.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No avatar file provided" },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Use JPEG, PNG, GIF, or WebP." },
        { status: 400 }
      );
    }

    if (file.size > MAX_AVATAR_SIZE) {
      return NextResponse.json(
        { error: "Avatar must be smaller than 2 MB" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop() ?? "jpg";
    const fileName = `${authUser.id}/${Date.now()}.${ext}`;

    const admin = createAdminClient();

    /* Ensure the avatars bucket exists */
    const { data: buckets } = await admin.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === AVATAR_BUCKET);
    if (!bucketExists) {
      const { error: createErr } = await admin.storage.createBucket(AVATAR_BUCKET, {
        public: true,
        fileSizeLimit: MAX_AVATAR_SIZE,
        allowedMimeTypes: ALLOWED_TYPES,
      });
      if (createErr) {
        console.error("[users/profile] bucket creation error:", createErr);
        return NextResponse.json(
          { error: "Failed to initialize avatar storage" },
          { status: 500 }
        );
      }
    }

    /* Upload the file */
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadErr } = await admin.storage
      .from(AVATAR_BUCKET)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) {
      console.error("[users/profile] upload error:", uploadErr);
      return NextResponse.json(
        { error: "Failed to upload avatar" },
        { status: 500 }
      );
    }

    /* Get public URL */
    const { data: urlData } = admin.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(fileName);
    const avatarUrl = urlData.publicUrl;

    /* Update user record */
    const supabase = await createClient();
    const { data: user, error: updateErr } = await supabase
      .from("users")
      .update({ avatar_url: avatarUrl })
      .eq("id", authUser.id)
      .select("id, name, avatar_url")
      .single();

    if (updateErr) {
      console.error("[users/profile] update avatar_url error:", updateErr);
      return NextResponse.json(
        { error: "Failed to save avatar" },
        { status: 500 }
      );
    }

    return NextResponse.json(user);
  } catch (err) {
    console.error("[users/profile] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth";
import { pusherServer, type ChatChannelEvents } from "@/lib/pusher-server";
import { getRoomId } from "@/lib/room";
import { getChannelName } from "@/lib/pusher-client";

const ATTACHMENTS_BUCKET = "attachments";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "application/pdf",
  "text/plain",
];
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export async function POST(req: NextRequest) {
  try {
    /* ---- Auth --------------------------------------------------- */
    const authUser = await getAuthUser(req);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    /* ---- Parse multipart form data ------------------------------ */
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const conversation_id = formData.get("conversation_id") as string | null;
    const reply_to_id = (formData.get("reply_to_id") as string | null) ?? null;
    const vanish_mode = formData.get("vanish_mode") === "true";
    const ephemeralRaw = formData.get("ephemeral_seconds") as string | null;
    const ephemeral_seconds = ephemeralRaw ? parseInt(ephemeralRaw, 10) || null : null;

    /* ---- Validate fields ----------------------------------------- */
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!conversation_id) {
      return NextResponse.json({ error: "Missing conversation_id" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Allowed: JPEG, PNG, GIF, WebP, MP4, PDF, TXT." },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File must be smaller than 10 MB" },
        { status: 400 },
      );
    }

    const userId = authUser.id;

    /* ---- Verify conversation membership -------------------------- */
    const supabase = await createClient();
    const { data: conv } = await supabase
      .from("conversations")
      .select("id, user_a, user_b")
      .eq("id", conversation_id)
      .single();
    if (!conv) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    if (conv.user_a !== userId && conv.user_b !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    /* ---- Resolve reply-to context -------------------------------- */
    let reply_to_content: string | null = null;
    let reply_to_sender_name: string | null = null;
    if (reply_to_id) {
      const { data: replyMsg } = await supabase
        .from("messages")
        .select("content, sender_id")
        .eq("id", reply_to_id)
        .single();
      if (replyMsg) {
        reply_to_content = replyMsg.content;
        const { data: replyUser } = await supabase
          .from("users")
          .select("name")
          .eq("id", replyMsg.sender_id)
          .single();
        reply_to_sender_name = replyUser?.name ?? null;
      }
    }

    /* ---- Resolve sender name ------------------------------------- */
    const { data: senderProfile } = await supabase
      .from("users")
      .select("name")
      .eq("id", userId)
      .single();
    const sender_name = senderProfile?.name ?? "Unknown";

    /* ---- Upload to Supabase Storage ------------------------------ */
    const admin = createAdminClient();

    /* Ensure bucket exists */
    const { data: buckets } = await admin.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === ATTACHMENTS_BUCKET);
    if (!bucketExists) {
      const { error: createErr } = await admin.storage.createBucket(ATTACHMENTS_BUCKET, {
        public: true,
        fileSizeLimit: MAX_FILE_SIZE,
        allowedMimeTypes: ALLOWED_TYPES,
      });
      if (createErr) {
        console.error("[messages/upload] bucket creation error:", createErr);
        return NextResponse.json(
          { error: "Failed to initialize attachment storage" },
          { status: 500 },
        );
      }
    }

    /* Build storage path */
    const ext = file.name.split(".").pop() ?? "bin";
    const storagePath = `${conversation_id}/${Date.now()}.${ext}`;

    /* Upload */
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadErr } = await admin.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadErr) {
      console.error("[messages/upload] upload error:", uploadErr);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 },
      );
    }

    /* Get public URL */
    const { data: urlData } = admin.storage
      .from(ATTACHMENTS_BUCKET)
      .getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    /* ---- Insert message record ----------------------------------- */
    const messageType = IMAGE_TYPES.has(file.type) ? "image" : "file";

    const { data: message, error: msgErr } = await supabase
      .from("messages")
      .insert({
        conversation_id,
        sender_id: userId,
        reply_to_id: reply_to_id ?? null,
        content: publicUrl,
        type: messageType,
        vanish_mode,
        ephemeral_seconds: ephemeral_seconds ?? null,
        status: "sent",
      })
      .select()
      .single();

    if (msgErr || !message) {
      console.error("[messages/upload] insert error:", msgErr);
      return NextResponse.json(
        { error: "Failed to save message" },
        { status: 500 },
      );
    }

    /* ---- Pusher real-time event ---------------------------------- */
    const otherUserId = conv.user_a === userId ? conv.user_b : conv.user_a;
    const roomId = getRoomId(userId, otherUserId);
    const channelName = getChannelName(roomId);

    const eventPayload: ChatChannelEvents["new-message"] = {
      id: message.id,
      conversation_id: message.conversation_id,
      sender_id: message.sender_id,
      sender_name,
      reply_to_id: message.reply_to_id,
      reply_to_content,
      reply_to_sender_name,
      content: message.content,
      type: message.type,
      status: message.status,
      vanish_mode: message.vanish_mode,
      ephemeral_seconds: message.ephemeral_seconds,
      voice_duration: message.voice_duration,
      waveform_data: message.waveform_data as number[] | null,
      reactions: (message.reactions as Record<string, string[]>) || {},
      created_at: message.created_at,
    };

    try {
      await pusherServer.trigger(channelName, "new-message", eventPayload);
    } catch (err) {
      console.error("[messages/upload] Pusher trigger failed (non-fatal):", err);
    }

    return NextResponse.json(message, { status: 201 });
  } catch (err) {
    console.error("[messages/upload] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

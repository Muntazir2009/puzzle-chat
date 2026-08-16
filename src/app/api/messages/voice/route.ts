import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const conversationId = formData.get("conversation_id") as string | null;

    if (!file)
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!conversationId)
      return NextResponse.json(
        { error: "No conversation_id" },
        { status: 400 }
      );

    const supabase = await createClient();

    // Verify conversation access
    const { data: conv } = await supabase
      .from("conversations")
      .select("id, user_a, user_b")
      .eq("id", conversationId)
      .single();

    if (!conv)
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );

    if (conv.user_a !== authUser.id && conv.user_b !== authUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Ensure bucket exists (ignore error if already exists)
    await supabase.storage
      .createBucket("chat-voice-notes", { public: true })
      .catch(() => {});

    // Upload voice note
    const ext = "webm";
    const filePath = `${conversationId}/${authUser.id}_${Date.now()}.${ext}`;

    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from("chat-voice-notes")
      .upload(filePath, file, {
        contentType: file.type || "audio/webm",
        upsert: false,
        cacheControl: "31536000",
      });

    if (uploadErr || !uploadData) {
      console.error("[voice/upload] upload error:", uploadErr);
      return NextResponse.json(
        { error: "Upload failed" },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage
      .from("chat-voice-notes")
      .getPublicUrl(uploadData.path);

    // Parse optional metadata
    const voice_duration = formData.get("voice_duration");
    const waveform_data = formData.get("waveform_data");
    const vanish_mode = formData.get("vanish_mode");
    const ephemeral_seconds = formData.get("ephemeral_seconds");
    const reply_to_id = formData.get("reply_to_id");

    // Resolve sender name
    const { data: senderProfile } = await supabase
      .from("users")
      .select("name")
      .eq("id", authUser.id)
      .single();
    const sender_name = senderProfile?.name ?? "Unknown";

    // Resolve reply-to context
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

    // Insert message record
    const { data: message, error: msgErr } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: authUser.id,
        content: urlData.publicUrl,
        type: "voice",
        voice_duration: voice_duration
          ? parseInt(voice_duration as string, 10)
          : null,
        waveform_data: waveform_data
          ? JSON.parse(waveform_data as string)
          : null,
        vanish_mode: vanish_mode === "true",
        ephemeral_seconds: ephemeral_seconds
          ? parseInt(ephemeral_seconds as string, 10)
          : null,
        reply_to_id: reply_to_id ? (reply_to_id as string) : null,
        status: "sent",
      })
      .select()
      .single();

    if (msgErr || !message) {
      console.error("[voice/upload] insert error:", msgErr);
      return NextResponse.json(
        { error: "Failed to save message" },
        { status: 500 }
      );
    }

    // Return the full message object (for optimistic UI replacement)
    return NextResponse.json({ ...message, sender_name }, { status: 201 });
  } catch (err) {
    console.error("[voice/upload] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

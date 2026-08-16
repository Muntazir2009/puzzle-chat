"use client"

import { useMemo } from "react";
import { ChatLayout } from "@/components/chat/ChatLayout";

/**
 * Demo page that renders the chat UI against mock participant data.
 * In production the server would resolve the conversation + partner
 * from the authenticated session and URL params.
 */
const DEMO_CURRENT_USER_ID = "a1b2c3d4-1111-4aaa-b111-111111111111";
const DEMO_OTHER_USER_ID = "e5f6a7b8-2222-4bbb-c222-222222222222";
const DEMO_CONVERSATION_ID = "c0c0c0c0-0000-4000-a000-000000000000";

export default function Home() {
  const partner = useMemo(
    () => ({
      id: DEMO_OTHER_USER_ID,
      name: "Alice Johnson",
      avatar_url: null,
    }),
    []
  );

  return (
    <ChatLayout
      currentUserId={DEMO_CURRENT_USER_ID}
      otherUserId={DEMO_OTHER_USER_ID}
      conversationId={DEMO_CONVERSATION_ID}
      partner={partner}
    />
  );
}
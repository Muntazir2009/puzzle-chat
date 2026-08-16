// Hand-written Supabase database types matching the schema.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          avatar_url: string | null;
          name: string;
          last_seen: string;
        };
        Insert: {
          id: string;
          avatar_url?: string | null;
          name: string;
          last_seen?: string;
        };
        Update: {
          id?: string;
          avatar_url?: string | null;
          name?: string;
          last_seen?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          user_a: string;
          user_b: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_a: string;
          user_b: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_a?: string;
          user_b?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "conversations_user_a_fkey"; columns: ["user_a"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "conversations_user_b_fkey"; columns: ["user_b"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string;
          reply_to_id: string | null;
          content: string;
          type: "text" | "image" | "file" | "voice";
          status: "sending" | "sent" | "delivered" | "read" | "failed";
          vanish_mode: boolean;
          ephemeral_seconds: number | null;
          voice_duration: number | null;
          waveform_data: number[] | null;
          reactions: Record<string, string[]>;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id: string;
          reply_to_id?: string | null;
          content: string;
          type?: "text" | "image" | "file" | "voice";
          status?: "sending" | "sent" | "delivered" | "read" | "failed";
          vanish_mode?: boolean;
          ephemeral_seconds?: number | null;
          voice_duration?: number | null;
          waveform_data?: number[] | null;
          reactions?: Record<string, string[]>;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string;
          reply_to_id?: string | null;
          content?: string;
          type?: "text" | "image" | "file" | "voice";
          status?: "sending" | "sent" | "delivered" | "read" | "failed";
          vanish_mode?: boolean;
          ephemeral_seconds?: number | null;
          voice_duration?: number | null;
          waveform_data?: number[] | null;
          reactions?: Record<string, string[]>;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "messages_conversation_id_fkey"; columns: ["conversation_id"]; isOneToOne: false; referencedRelation: "conversations"; referencedColumns: ["id"] },
          { foreignKeyName: "messages_sender_id_fkey"; columns: ["sender_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_or_create_conversation: {
        Args: { other_user_id: string };
        Returns: string;
      };
    };
    Enums: {
      message_type: "text" | "image" | "file" | "voice";
      message_status: "sending" | "sent" | "delivered" | "read" | "failed";
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
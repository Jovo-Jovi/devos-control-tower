import { createWebhookHandler } from "@/lib/supabase/server/webhook";

export const POST = createWebhookHandler();


-- Chat conversations table
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  customer_name text,
  customer_phone text,
  customer_email text,
  status text NOT NULL DEFAULT 'active',
  messages_count integer NOT NULL DEFAULT 0,
  last_message_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Chat messages table
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Public can insert (chatbot saves from edge function using service role)
CREATE POLICY "Anyone can insert conversations" ON public.chat_conversations FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update conversations" ON public.chat_conversations FOR UPDATE TO public USING (true);
CREATE POLICY "Admins can view conversations" ON public.chat_conversations FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can insert messages" ON public.chat_messages FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admins can view messages" ON public.chat_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = chat_messages.conversation_id)
);

-- Index for performance
CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(conversation_id);
CREATE INDEX idx_chat_conversations_session ON public.chat_conversations(session_id);

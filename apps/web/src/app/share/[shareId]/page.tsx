import type { Metadata } from 'next';

import { SharedConversationView } from '@/features/conversations/components/shared-conversation-view';

export const metadata: Metadata = {
  title: 'Shared Conversation — Eskwelabs Advisor',
  robots: { index: false, follow: false }
};

export default async function SharedConversationPage({
  params
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  return <SharedConversationView shareId={shareId} />;
}

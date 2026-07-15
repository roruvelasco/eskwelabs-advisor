'use client';

import { useMutation } from '@tanstack/react-query';
import { Link2, Loader2 } from 'lucide-react';
import { Button, toast } from '@eskwelabs-advisor/ui';
import { shareConversation } from '@/lib/domains/conversations/api';

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback for non-secure contexts where the Clipboard API is unavailable
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    if (!document.execCommand('copy')) {
      throw new Error('Copy command failed');
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

export function CopyConversationLinkButton({
  conversationId
}: {
  conversationId: string;
}) {
  const shareMutation = useMutation({
    mutationFn: async () => {
      const { data } = await shareConversation(conversationId);
      await copyToClipboard(data.url);
      return data;
    },
    onSuccess: (data) => {
      toast.success('Conversation link copied!', {
        action: {
          label: 'Open',
          onClick: () => window.open(data.url, '_blank', 'noopener')
        }
      });
    },
    onError: () => {
      toast.error('Could not copy conversation link. Please try again.');
    }
  });

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={shareMutation.isPending}
      onClick={() => shareMutation.mutate()}
      aria-label="Copy Conversation Link"
    >
      {shareMutation.isPending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Link2 className="size-4" />
      )}
      <span className="max-md:sr-only">Copy Conversation Link</span>
    </Button>
  );
}

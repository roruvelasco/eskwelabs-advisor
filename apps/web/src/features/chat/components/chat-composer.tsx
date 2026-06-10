'use client';

import { useRef, useState } from 'react';
import { SendHorizonal } from 'lucide-react';
import { Button, Textarea } from '@eskwelabs-advisor/ui';
import { cn } from '@/lib/utils';

interface ChatComposerProps {
  onSend?: (text: string) => void;
  disabled?: boolean;
}

export function ChatComposer({ disabled = false, onSend }: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState('');

  const hasText = value.trim().length > 0;

  const resetHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    handleInput();
  };

  const submit = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend?.(text);
    setValue('');
    resetHeight();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      className={cn(
        'bg-card mx-auto flex w-full max-w-2xl items-center gap-2 rounded-xl border px-3 py-2 transition-all duration-200 ease-in-out',
        hasText ? 'border-border/60' : 'border-primary/70 hover:border-primary'
      )}
    >
      <Textarea
        ref={textareaRef}
        rows={1}
        value={value}
        placeholder="Ask your advisor anything..."
        aria-label="Message"
        disabled={disabled}
        className={cn(
          'placeholder:text-muted-foreground/50 min-h-0 flex-1 resize-none border-0 bg-transparent p-0 text-base leading-relaxed shadow-none focus-visible:ring-0',
          hasText ? 'max-h-40' : 'max-h-[1.75rem]'
        )}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />

      <Button
        variant="default"
        size="icon"
        aria-label="Send message"
        type="button"
        disabled={!hasText || disabled}
        onClick={submit}
        className={cn(
          'motion-press mb-0.5 shrink-0 transition-all duration-150 active:scale-95',
          hasText ? 'size-8 rounded-full' : 'size-8 rounded-lg'
        )}
      >
        <SendHorizonal size={15} aria-hidden="true" />
      </Button>
    </div>
  );
}

'use client';

import { useRef } from 'react';
import { ArrowUp, Plus } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@eskwelabs-advisor/ui';

export function ChatComposer() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
    }
  };

  return (
    <Card className="motion-lift border-border/70 bg-card/95 w-full max-w-2xl shadow-md">
      <CardContent className="p-0">
        <Textarea
          ref={textareaRef}
          rows={1}
          placeholder="Ask your advisor anything..."
          aria-label="Message"
          className="max-h-40 resize-none overflow-y-auto border-0 p-4 text-base shadow-none focus-visible:ring-0"
          onInput={handleInput}
          onKeyDown={handleKeyDown}
        />
        <div className="flex items-center justify-between px-3 pb-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Add attachment"
                type="button"
              >
                <Plus size={18} aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add attachment</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="icon"
                className="rounded-full"
                aria-label="Send message"
                type="button"
              >
                <ArrowUp size={18} aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send message</TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    </Card>
  );
}

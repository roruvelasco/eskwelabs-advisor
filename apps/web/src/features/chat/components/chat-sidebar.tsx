'use client';

import { Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  AppBrand,
  Avatar,
  AvatarFallback,
  Button,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar
} from '@eskwelabs-advisor/ui';
import { conversationsQuery } from '@/lib/domains/conversations/queries';

function RecentConversationButton({
  conversation,
  onClick
}: {
  conversation: { id: string; title: string; advisorId: string };
  onClick: () => void;
}) {
  const { isMobile, setOpenMobile } = useSidebar();

  const handleClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
    onClick();
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={conversation.title}>
        <button type="button" onClick={handleClick}>
          <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            {conversation.title}
          </span>
        </button>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function ChatSidebar() {
  const router = useRouter();
  const { data, isLoading, isError } = useQuery(conversationsQuery());

  const conversations = (data?.data ?? []) as Array<{
    id: string;
    title: string;
    advisorId: string;
  }>;

  return (
    <Sidebar id="chat-sidebar" collapsible="offcanvas" className="!border-r-0">
      <SidebarHeader className="gap-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <AppBrand />
          <SidebarTrigger aria-label="Close sidebar" className="size-9" />
        </div>

        <Button
          variant="ghost"
          className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent w-full justify-start gap-2 font-normal"
          type="button"
        >
          <Plus size={15} aria-hidden="true" />
          New chat
        </Button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="uppercase tracking-widest">
            Recents
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {isLoading ? (
              <p className="text-muted-foreground px-3 text-sm">
                Loading conversations...
              </p>
            ) : isError ? (
              <p className="text-muted-foreground px-3 text-sm">
                Could not load conversations.
              </p>
            ) : conversations.length === 0 ? (
              <p className="text-muted-foreground px-3 text-sm">
                No recent conversations yet.
              </p>
            ) : (
              <SidebarMenu>
                {conversations.map((conversation) => (
                  <RecentConversationButton
                    key={conversation.id}
                    conversation={conversation}
                    onClick={() =>
                      router.push(`/chat?conversation=${conversation.id}`)
                    }
                  />
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
          <Avatar className="size-8">
            <AvatarFallback>N</AvatarFallback>
          </Avatar>
          <span className="text-muted-foreground min-w-0 truncate text-sm">
            Mentor workspace
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

'use client';

import { MessageSquareText, Plus } from 'lucide-react';
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
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar
} from '@eskwelabs-advisor/ui';

const RECENT_CONVERSATIONS = [
  'How to structure my data science portfcdddddddddddddddddddddddolio',
  'Understanding the EIF program requirements',
  'Python pandas groupby explained',
  'Resume review for data roles',
  'Bootcamp capstone project ideas',
  'SQL window functions deep dive',
  'How to negotiate my first tech offer',
  'Data storytelling with Tableau'
];

function RecentConversationButton({ title }: { title: string }) {
  const { isMobile, setOpenMobile } = useSidebar();

  const closeMobileSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={title}>
        <button type="button" onClick={closeMobileSidebar}>
          <MessageSquareText aria-hidden="true" />
          <span className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            {title}
          </span>
        </button>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function ChatSidebar() {
  return (
    <Sidebar id="chat-sidebar" collapsible="offcanvas">
      <SidebarHeader className="gap-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <AppBrand />
          <SidebarTrigger aria-label="Close sidebar" className="size-9" />
        </div>

        <Button variant="default" className="w-full gap-2" type="button">
          <Plus size={16} aria-hidden="true" />
          New Chat
        </Button>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="uppercase tracking-widest">
            Recents
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {RECENT_CONVERSATIONS.map((title) => (
                <RecentConversationButton key={title} title={title} />
              ))}
            </SidebarMenu>
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

      <SidebarRail />
    </Sidebar>
  );
}

'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronsUpDown, PlusIcon } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast
} from '@eskwelabs-advisor/ui';

import { createUser, updateUser } from '@/lib/domains/admin/api';
import { usersQuery } from '@/lib/domains/admin/queries';

interface UserRow {
  id: string;
  email: string;
  role: 'eif' | 'admin';
  isActive: boolean;
  createdAt: string;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium'
  });
}

function SortHead({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TableHead className={className}>
      <span className="flex items-center gap-1.5 text-xs uppercase tracking-widest">
        {children}
        <ChevronsUpDown className="text-muted-foreground/40 size-3 shrink-0" />
      </span>
    </TableHead>
  );
}

function CreateUserButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PlusIcon className="size-4" />
        Add User
      </Button>
      {open && <CreateUserDialogInline onClose={() => setOpen(false)} />}
    </>
  );
}

function CreateUserDialogInline({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'eif' | 'admin'>('eif');
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () => createUser({ email: email.trim(), role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'usage'] });
      toast.success(`User ${email.trim()} saved`);
      setEmail('');
      setRole('eif');
      onClose();
    },
    onError: () => {
      toast.error('Failed to save user');
    }
  });

  function submit() {
    if (!email.trim()) return;
    mutate();
  }

  return (
    <Dialog open={true} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="admin-user-email">Google Email</Label>
            <Input
              id="admin-user-email"
              type="email"
              placeholder="intern@eskwelabs.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit();
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="admin-user-role">Role</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as 'eif' | 'admin')}
            >
              <SelectTrigger id="admin-user-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="eif">EIF</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter showCloseButton>
          <Button onClick={submit} disabled={isPending || !email.trim()}>
            {isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActiveSwitch({ user }: { user: UserRow }) {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: (isActive: boolean) => updateUser(user.id, { isActive }),
    onSuccess: (_, isActive) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success(isActive ? 'User reactivated' : 'User deactivated');
    },
    onError: () => {
      toast.error('Failed to update user');
    }
  });

  return (
    <Switch
      checked={user.isActive}
      disabled={isPending}
      onCheckedChange={(checked) => mutate(checked)}
      aria-label={user.isActive ? 'Deactivate user' : 'Activate user'}
    />
  );
}

export function UsersPanel() {
  const { data, isLoading, error } = useQuery(usersQuery());
  const users = (data as { data: UserRow[] } | undefined)?.data ?? [];

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive text-sm">Failed to load users.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative flex flex-1 flex-col">
      <div className="flex items-center justify-end border-b px-4 py-3 sm:px-6">
        <CreateUserButton />
      </div>
      <CardContent className="flex flex-1 flex-col p-0">
        {isLoading ? (
          <div className="space-y-3 px-8 py-8">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-muted-foreground text-sm">No users found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHead className="pl-6">Email</SortHead>
                  <SortHead>Role</SortHead>
                  <SortHead>Created</SortHead>
                  <SortHead>Active</SortHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="py-4 pl-6 font-medium">
                      {user.email}
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge
                        variant={
                          user.role === 'admin' ? 'default' : 'secondary'
                        }
                      >
                        {user.role === 'admin' ? 'Admin' : 'EIF'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground py-4 text-sm">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell className="py-4 pr-6">
                      <ActiveSwitch user={user} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

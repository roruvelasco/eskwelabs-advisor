'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';

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
  Switch,
  toast
} from '@eskwelabs-advisor/ui';

import { createUser, updateUser } from '@/lib/domains/admin/api';
import { usersQuery } from '@/lib/domains/admin/queries';
import { AdminDataTable } from './admin-data-table';
import type { ColumnDef } from '@tanstack/react-table';

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

export function CreateUserButton() {
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
      <CardContent className="flex flex-1 flex-col p-0">
        <AdminDataTable
          columns={
            [
              {
                accessorKey: 'email',
                header: 'Email',
                cell: ({ row }) => (
                  <span className="font-medium">{row.original.email}</span>
                )
              },
              {
                accessorKey: 'role',
                header: 'Role',
                cell: ({ row }) => (
                  <Badge
                    variant={
                      row.original.role === 'admin' ? 'default' : 'secondary'
                    }
                  >
                    {row.original.role === 'admin' ? 'Admin' : 'EIF'}
                  </Badge>
                )
              },
              {
                accessorKey: 'createdAt',
                header: 'Created',
                cell: ({ row }) => (
                  <span className="text-muted-foreground text-sm">
                    {formatDate(row.original.createdAt)}
                  </span>
                )
              },
              {
                id: 'active',
                header: 'Active',
                cell: ({ row }) => <ActiveSwitch user={row.original} />
              }
            ] as ColumnDef<UserRow>[]
          }
          data={users}
          isLoading={isLoading}
          emptyMessage="No users found."
          enableSorting={true}
          enablePagination={false}
        />
      </CardContent>
    </Card>
  );
}

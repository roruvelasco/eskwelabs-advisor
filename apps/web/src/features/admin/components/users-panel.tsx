'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
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
  consentAcknowledgedAt: string | null;
  createdAt: string;
}

function formatDate(iso: string | null) {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium'
  });
}

function CreateUserDialog() {
  const [open, setOpen] = useState(false);
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
      setOpen(false);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="size-4" />
          Add User
        </Button>
      </DialogTrigger>
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
  const { data, isLoading, error } = useQuery(usersQuery);
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Users</CardTitle>
        <CreateUserDialog />
      </CardHeader>
      <Separator />
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 px-6 py-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="text-muted-foreground px-6 py-6 text-sm">
            No users found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Consent</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.role === 'admin' ? 'default' : 'secondary'
                        }
                      >
                        {user.role === 'admin' ? 'Admin' : 'EIF'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.consentAcknowledgedAt ? (
                        <Badge
                          variant="outline"
                          className="text-success border-success/30"
                        >
                          Acknowledged
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell>
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

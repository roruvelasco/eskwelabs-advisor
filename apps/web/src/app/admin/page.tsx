'use client';

import dynamic from 'next/dynamic';

const AdminDashboard = dynamic(
  () =>
    import('@/features/admin/components/admin-dashboard').then(
      (m) => m.AdminDashboard
    ),
  { ssr: false }
);

export default function AdminPage() {
  return <AdminDashboard />;
}

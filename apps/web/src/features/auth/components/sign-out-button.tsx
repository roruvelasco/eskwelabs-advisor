'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@eskwelabs-advisor/ui';

export function SignOutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/signout', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to sign out');
      }

      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleSignOut}
      disabled={isLoading}
      variant="outline"
      size="sm"
    >
      {isLoading ? 'Signing out...' : 'Sign out'}
    </Button>
  );
}

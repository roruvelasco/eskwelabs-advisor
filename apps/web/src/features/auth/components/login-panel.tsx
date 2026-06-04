'use client';

import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { useState } from 'react';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@eskwelabs-advisor/ui';

export function LoginPanel() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn('google', { callbackUrl: '/consent', redirect: true });
    } finally {
      setIsLoading(false);
    }
  };

  const errorMessages: Record<string, string> = {
    NotAllowlisted:
      'Your account is not on the allow-list. Please contact an administrator.',
    AccessDenied: 'Access was denied. Please try again.',
    OAuthSignin: 'Error connecting to Google. Please try again.',
    OAuthCallback: 'Error during authentication. Please try again.',
    EmailSigninError: 'Sign in failed. Please try again.',
    Default: 'An error occurred during sign in. Please try again.'
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Sign in to Eskwelabs Advisor</CardTitle>
          <CardDescription>
            Sign in with your Google account to access the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3">
              <p className="text-sm text-red-800">
                {errorMessages[error] || errorMessages.Default}
              </p>
            </div>
          )}
          <Button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? 'Signing in...' : 'Continue with Google'}
          </Button>
          <p className="text-xs text-zinc-500">
            Only allow-listed accounts can access this platform.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

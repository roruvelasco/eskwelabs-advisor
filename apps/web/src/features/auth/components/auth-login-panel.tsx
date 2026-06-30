'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { z } from 'zod';

import {
  AppBrand,
  Button,
  Card,
  CardContent,
  GrainOverlay,
  Input,
  Label,
  Separator,
  toast
} from '@eskwelabs-advisor/ui';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.')
});

type LoginErrors = Partial<Record<keyof z.infer<typeof loginSchema>, string>>;

export interface AuthLoginConfig {
  googleProviderId: string;
  credentialsProviderId: string;
  heading: string;
  subtitle: string;
  errorMessages: Record<string, string>;
  inputIdPrefix?: string;
}

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="size-4"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AuthErrorToast({
  errorMessages
}: {
  errorMessages: Record<string, string>;
}) {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  useEffect(() => {
    if (error) {
      toast.error(errorMessages[error] ?? errorMessages.Default);
    }
  }, [error, errorMessages]);

  return null;
}

export function AuthLoginPanel({ config }: { config: AuthLoginConfig }) {
  const {
    googleProviderId,
    credentialsProviderId,
    heading,
    subtitle,
    errorMessages,
    inputIdPrefix = ''
  } = config;

  const searchParams = useSearchParams();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<LoginErrors>({});
  const rawReturnTo = searchParams.get('returnTo');
  const continueUrl = `/auth/continue?returnTo=${encodeURIComponent(rawReturnTo ?? '')}`;

  const isAnyLoading = isGoogleLoading || isEmailLoading;

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await signIn(googleProviderId, { callbackUrl: continueUrl });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleEmailSignIn = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: LoginErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof LoginErrors;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setIsEmailLoading(true);
    try {
      await signIn(credentialsProviderId, {
        email,
        password,
        callbackUrl: continueUrl,
        redirect: true
      });
    } finally {
      setIsEmailLoading(false);
    }
  };

  return (
    <GrainOverlay
      intensity="strong"
      className="bg-background flex h-dvh flex-col md:flex-row"
    >
      <Suspense>
        <AuthErrorToast errorMessages={errorMessages} />
      </Suspense>
      <div className="flex flex-1 flex-col px-8 py-10 md:px-16 md:py-14">
        <AppBrand />

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-10">
          <div className="space-y-2 text-center">
            <h1 className="text-foreground text-balance font-serif text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl">
              {heading}
            </h1>
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          </div>

          <Card>
            <CardContent className="space-y-4 pt-6">
              <Button
                variant="outline"
                className="w-full gap-2.5"
                size="lg"
                onClick={handleGoogleSignIn}
                disabled={isAnyLoading}
              >
                {isGoogleLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                {isGoogleLoading ? 'Signing in...' : 'Continue with Google'}
              </Button>

              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-muted-foreground text-xs uppercase tracking-widest">
                  or
                </span>
                <Separator className="flex-1" />
              </div>

              <form
                className="space-y-4"
                onSubmit={(event) => void handleEmailSignIn(event)}
              >
                <div className="space-y-1.5">
                  <Label htmlFor={`${inputIdPrefix}email`}>Email</Label>
                  <Input
                    id={`${inputIdPrefix}email`}
                    type="email"
                    placeholder="you@eskwelabs.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email)
                        setErrors((p) => ({ ...p, email: undefined }));
                    }}
                  />
                  {errors.email && (
                    <p className="text-destructive text-xs">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`${inputIdPrefix}password`}>Password</Label>
                  <div className="relative">
                    <Input
                      id={`${inputIdPrefix}password`}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pr-10"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errors.password)
                          setErrors((p) => ({ ...p, password: undefined }));
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      className="absolute right-0 top-0 h-full w-auto px-3"
                      onClick={() => setShowPassword((p) => !p)}
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </div>
                  {errors.password && (
                    <p className="text-destructive text-xs">
                      {errors.password}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full gap-2.5"
                  size="lg"
                  disabled={isAnyLoading}
                >
                  {isEmailLoading && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  {isEmailLoading ? 'Signing in...' : 'Continue with email'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="pr-25 hidden items-end md:flex md:w-2/5">
        <div className="bg-primary h-[88%] w-full rounded-t-3xl" />
      </div>
    </GrainOverlay>
  );
}

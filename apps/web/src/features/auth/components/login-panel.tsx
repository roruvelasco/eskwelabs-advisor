import { AuthLoginPanel, type AuthLoginConfig } from './auth-login-panel';

const eifConfig: AuthLoginConfig = {
  googleProviderId: 'google',
  credentialsProviderId: 'credentials',
  heading: 'Advise with clarity.',
  subtitle: 'Your AI-powered coaching companion for EIF mentorship.',
  errorMessages: {
    NotAllowlisted:
      'Your account is not on the allow-list. Please contact an administrator.',
    AdminRequired: 'Use an admin account to access the admin portal.',
    UseAdminLogin: 'Use the admin portal to sign in with this account.',
    AccessDenied: 'Access was denied. Please try again.',
    OAuthSignin: 'Error connecting to Google. Please try again.',
    OAuthCallback: 'Error during authentication. Please try again.',
    AuthServiceUnavailable:
      'Sign in is temporarily unavailable. Please try again later.',
    CredentialsSignin: 'Invalid email or password. Please try again.',
    EmailSigninError: 'Sign in failed. Please try again.',
    Default: 'An error occurred during sign in. Please try again.'
  }
};

export function LoginPanel() {
  return <AuthLoginPanel config={eifConfig} />;
}

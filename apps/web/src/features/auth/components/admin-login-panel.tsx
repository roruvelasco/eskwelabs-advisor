import { AuthLoginPanel, type AuthLoginConfig } from './auth-login-panel';

const adminConfig: AuthLoginConfig = {
  googleProviderId: 'google-admin',
  credentialsProviderId: 'credentials-admin',
  heading: 'Admin Portal',
  subtitle: 'Sign in with your admin Google account.',
  inputIdPrefix: 'admin-',
  errorMessages: {
    NotAllowlisted: 'Your account is not on the admin allow-list.',
    AdminRequired: 'Use an admin account to access the admin portal.',
    UseAdminLogin: 'Use the admin portal to sign in with this account.',
    AccessDenied: 'Access was denied. Please try again.',
    OAuthSignin: 'Error connecting to Google. Please try again.',
    OAuthCallback: 'Error during authentication. Please try again.',
    AuthServiceUnavailable:
      'Sign in is temporarily unavailable. Please try again later.',
    Default: 'An error occurred during sign in. Please try again.'
  }
};

export function AdminLoginPanel() {
  return <AuthLoginPanel config={adminConfig} />;
}

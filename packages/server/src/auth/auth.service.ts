export class AuthService {
  async getSession() {
    return { userId: 'stub-user-id', role: 'eif' as const };
  }
}

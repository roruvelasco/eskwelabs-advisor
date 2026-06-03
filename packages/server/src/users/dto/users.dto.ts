import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { usersTable } from '../users.schema';

const userSelectSchema = createSelectSchema(usersTable);

export const userDto = userSelectSchema.pick({
  id: true,
  email: true,
  role: true,
  isActive: true,
  consentAcknowledgedAt: true,
  createdAt: true
});

export type UserDto = z.infer<typeof userDto>;

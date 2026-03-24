import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { ok, err } from '@/lib/response'
import { randomBytes } from 'crypto'

export async function POST() {
  const count = await prisma.user.count()
  if (count > 0) return err('Setup already complete', 400)

  const apiKey = randomBytes(20).toString('hex')
  const org = await prisma.organization.create({
    data: { name: 'Default Organization', apiKey },
  })
  await prisma.user.create({
    data: {
      orgId: org.id,
      email: 'admin@company.com',
      hashedPassword: await hashPassword('admin123'),
      fullName: 'System Administrator',
      isAdmin: true,
    },
  })
  return ok({ message: 'Setup complete', email: 'admin@company.com', password: 'admin123', api_key: apiKey })
}

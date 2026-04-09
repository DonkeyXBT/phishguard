import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { ok, err } from '@/lib/response'

const SEED_TOKEN = 'a3fbeba92037986f711314060643df62d208ed3df3f21b662417650f8f5cbd06'

export async function POST(req: Request) {
  const { token, email, password, fullName } = await req.json()
  if (token !== SEED_TOKEN) return err('Unauthorized', 401)
  if (!email || !password) return err('Email and password required')

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return err('User already exists', 400)

  let org = await prisma.organization.findFirst()
  if (!org) {
    const { randomBytes } = await import('crypto')
    org = await prisma.organization.create({
      data: { name: 'Default Organization', apiKey: randomBytes(20).toString('hex') },
    })
  }

  await prisma.user.create({
    data: {
      orgId: org.id,
      email,
      hashedPassword: await hashPassword(password),
      fullName: fullName || 'Admin',
      isAdmin: true,
    },
  })

  return ok({ message: 'Admin user created', email })
}

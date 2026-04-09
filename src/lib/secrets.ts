/**
 * Secrets management abstraction.
 *
 * Provides a unified interface for loading secrets from multiple backends:
 *   1. Environment variables (default / development)
 *   2. AWS Secrets Manager (when SECRETS_PROVIDER=aws)
 *   3. HashiCorp Vault (when SECRETS_PROVIDER=vault)
 *   4. Azure Key Vault (when SECRETS_PROVIDER=azure)
 *
 * Usage:
 *   const jwtSecret = await getSecret('JWT_SECRET')
 *
 * In production, set SECRETS_PROVIDER and the provider-specific config.
 * In development, secrets are read from process.env as usual.
 */

export type SecretsProvider = 'env' | 'aws' | 'vault' | 'azure'

interface SecretCache {
  value: string
  expiresAt: number
}

const cache = new Map<string, SecretCache>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getProvider(): SecretsProvider {
  return (process.env.SECRETS_PROVIDER as SecretsProvider) || 'env'
}

/** Read a secret from environment variables. */
function fromEnv(key: string): string | undefined {
  return process.env[key]
}

/** Read a secret from AWS Secrets Manager. */
async function fromAws(key: string): Promise<string | undefined> {
  const region = process.env.AWS_REGION ?? 'us-east-1'
  const secretId = process.env.AWS_SECRET_ID ?? 'phishguard/secrets'

  try {
    // Dynamic require — only loaded when AWS provider is used
    const aws = require('@aws-sdk/client-secrets-manager') as any
    const client = new aws.SecretsManagerClient({ region })
    const response = await client.send(new aws.GetSecretValueCommand({ SecretId: secretId }))
    if (response.SecretString) {
      const secrets = JSON.parse(response.SecretString)
      return secrets[key]
    }
  } catch (e) {
    console.error(`[secrets] AWS Secrets Manager error for ${key}:`, e)
  }
  return undefined
}

/** Read a secret from HashiCorp Vault. */
async function fromVault(key: string): Promise<string | undefined> {
  const addr = process.env.VAULT_ADDR ?? 'http://127.0.0.1:8200'
  const token = process.env.VAULT_TOKEN
  const path = process.env.VAULT_SECRET_PATH ?? 'secret/data/phishguard'

  if (!token) {
    console.error('[secrets] VAULT_TOKEN not set')
    return undefined
  }

  try {
    const res = await fetch(`${addr}/v1/${path}`, {
      headers: { 'X-Vault-Token': token },
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) throw new Error(`Vault HTTP ${res.status}`)
    const data = await res.json()
    return data?.data?.data?.[key]
  } catch (e) {
    console.error(`[secrets] Vault error for ${key}:`, e)
  }
  return undefined
}

/** Read a secret from Azure Key Vault. */
async function fromAzure(key: string): Promise<string | undefined> {
  const vaultUrl = process.env.AZURE_KEYVAULT_URL
  if (!vaultUrl) {
    console.error('[secrets] AZURE_KEYVAULT_URL not set')
    return undefined
  }

  try {
    const azureIdentity = require('@azure/identity') as any
    const azureSecrets = require('@azure/keyvault-secrets') as any
    const credential = new azureIdentity.DefaultAzureCredential()
    const client = new azureSecrets.SecretClient(vaultUrl, credential)
    // Azure Key Vault uses hyphens, not underscores
    const secretName = key.toLowerCase().replace(/_/g, '-')
    const secret = await client.getSecret(secretName)
    return secret.value
  } catch (e) {
    console.error(`[secrets] Azure Key Vault error for ${key}:`, e)
  }
  return undefined
}

/**
 * Get a secret value.
 * Falls back to environment variables if the configured provider fails.
 */
export async function getSecret(key: string): Promise<string | undefined> {
  // Check cache first
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  const provider = getProvider()
  let value: string | undefined

  switch (provider) {
    case 'aws':
      value = await fromAws(key)
      break
    case 'vault':
      value = await fromVault(key)
      break
    case 'azure':
      value = await fromAzure(key)
      break
    case 'env':
    default:
      value = fromEnv(key)
      break
  }

  // Fallback to env if provider returned nothing
  if (!value && provider !== 'env') {
    value = fromEnv(key)
  }

  if (value) {
    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL })
  }

  return value
}

/**
 * Get a required secret — throws if not found.
 */
export async function requireSecret(key: string): Promise<string> {
  const value = await getSecret(key)
  if (!value) {
    throw new Error(`Required secret "${key}" not found in ${getProvider()} provider or environment`)
  }
  return value
}

/** Clear the secrets cache (useful for testing). */
export function clearSecretCache(): void {
  cache.clear()
}

/** Only the configured API receives the user's bearer token. Never log provider responses. */
export async function requestWalletSession({
  endpoint, apiOrigin, accessToken, userId, otpCode,
}: {
  endpoint: string; apiOrigin: string; accessToken?: string; userId?: string; otpCode?: string
}): Promise<string> {
  if (!accessToken || !userId) throw new Error('Please sign in again to access your wallet.')
  let target: URL
  try {
    target = new URL(endpoint, apiOrigin)
    if (target.origin !== new URL(apiOrigin).origin || !['https:', 'http:'].includes(target.protocol) ||
        target.username || target.password) throw new Error()
  } catch {
    throw new Error('The wallet service address is not configured correctly.')
  }
  let response: Response
  try {
    response = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ user_id: userId, otp_code: otpCode }),
      signal: AbortSignal.timeout(20_000),
      redirect: 'error',
      cache: 'no-store',
    })
  } catch {
    throw new Error('Wallet service could not be reached. Check your connection and try again.')
  }
  if (response.status === 401) throw new Error('Your sign-in has expired. Please sign in again.')
  if (response.status === 403) throw new Error('This sign-in cannot access the requested wallet. Please sign in again.')
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok || !data || typeof data !== 'object' || !('session' in data) ||
      typeof data.session !== 'string' || !data.session) {
    throw new Error('Wallet service is unavailable. Please try again later.')
  }
  return data.session
}

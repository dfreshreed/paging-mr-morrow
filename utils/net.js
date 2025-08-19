import dns from 'node:dns/promises';

export async function waitForDns(
  hosts,
  { timeoutMs = 15000, intervalMs = 1000 } = {}
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await Promise.all(hosts.map((host) => dns.lookup(host)));
      return true; // DNS working for all hosts
    } catch {
      /* still waking up*/
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return false;
}

export function isTransientNetError(err) {
  const code = err?.code || '';
  return [
    'ENOTFOUND',
    'EAI_AGAIN',
    'ETIMEOUT',
    'ECONNRESET',
    'ECONNREFUSED',
  ].includes(code);
}

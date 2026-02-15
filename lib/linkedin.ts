
// Helper to get the base URL
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
};

export const LINKEDIN_CONFIG = {
  clientId: '86j7ddjv9w7b8m',
  // Dynamic redirect URI used for client-side display logic if needed
  get redirectUri() {
    return `${getBaseUrl()}/api/linkedin/callback`;
  },
  scopes: ['openid', 'profile', 'email', 'w_member_social'],
};

export const generateLinkedInAuthUrl = (userId: string) => {
  // Encode userId in state to identify the user when LinkedIn calls back the server
  const statePayload = JSON.stringify({ 
    userId, 
    nonce: Math.random().toString(36).substring(2, 15) 
  });
  const state = btoa(statePayload);

  // We ensure the redirect URI matches exactly what the API route expects
  const redirectUri = `${getBaseUrl()}/api/linkedin/callback`;

  const url = new URL('https://www.linkedin.com/oauth/v2/authorization');
  url.searchParams.append('response_type', 'code');
  url.searchParams.append('client_id', LINKEDIN_CONFIG.clientId);
  url.searchParams.append('redirect_uri', redirectUri);
  url.searchParams.append('state', state);
  url.searchParams.append('scope', LINKEDIN_CONFIG.scopes.join(' '));

  return url.toString();
};

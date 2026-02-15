import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'buffer';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // Frontend URL (Base URL for redirects)
  const baseUrl = origin;

  if (error) {
    return NextResponse.redirect(`${baseUrl}/#/app/settings?error=${error}&msg=${searchParams.get('error_description')}`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/#/app/settings?error=missing_code`);
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Server configuration error: Missing DB Credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Exchange Authorization Code for Access Token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        redirect_uri: `${baseUrl}/api/linkedin/callback`,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      throw new Error(tokenData.error_description || 'LinkedIn token exchange failed');
    }

    const accessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in;

    // Fetch LinkedIn Profile ID
    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (!profileResponse.ok) {
        throw new Error('Failed to fetch LinkedIn profile info');
    }
    
    const profileData = await profileResponse.json();
    const linkedinId = profileData.sub;

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

    // Identify user via state param
    const state = searchParams.get('state');
    let userId = null;
    
    if (state) {
        try {
            const stateJson = Buffer.from(state, 'base64').toString('ascii');
            const parsed = JSON.parse(stateJson);
            userId = parsed.userId;
        } catch (e) {
            console.warn("Could not parse state for userId");
        }
    }

    if (userId) {
      const { error: dbError } = await supabase
        .from('profiles')
        .update({
          linkedin_token: accessToken,
          linkedin_profile_id: linkedinId,
          linkedin_connected: true,
          linkedin_token_expires_at: expiresAt.toISOString()
        })
        .eq('user_id', userId);

      if (dbError) throw dbError;
    } else {
       console.warn("No userId found in state. Token exchange successful but profile not updated.");
    }

    return NextResponse.redirect(`${baseUrl}/#/app/settings?success=true`);

  } catch (err: any) {
    console.error('LinkedIn OAuth Processing Error:', err);
    return NextResponse.redirect(`${baseUrl}/#/app/settings?error=exchange_failed&msg=${encodeURIComponent(err.message)}`);
  }
}
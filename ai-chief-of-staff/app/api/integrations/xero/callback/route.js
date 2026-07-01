import { NextResponse } from "next/server";
import {
  exchangeXeroOAuthCode,
  getXeroCredentials,
  validateXeroCredentials,
} from "@/lib/xero/server";
import { readIntegrations, writeIntegrations } from "@/lib/current-data-store";
import { getAppUrl } from "@/lib/slack/server";

export async function GET(request) {
  const appUrl = getAppUrl(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get("xero_oauth_state")?.value;
  const { clientId, clientSecret } = getXeroCredentials();

  try {
    if (!code) {
      return NextResponse.redirect(`${appUrl}/integrations?xero_error=missing_code`);
    }
    if (!state || !expectedState || state !== expectedState) {
      return NextResponse.redirect(`${appUrl}/integrations?xero_error=invalid_oauth_state`);
    }
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${appUrl}/integrations?xero_error=missing_credentials`);
    }

    const redirectUri = `${appUrl}/api/integrations/xero/callback`;
    const tokenData = await exchangeXeroOAuthCode({
      clientId,
      clientSecret,
      code,
      redirectUri,
    });
    const account = await validateXeroCredentials({
      accessToken: tokenData.access_token,
    });
    const integrations = await readIntegrations();
    await writeIntegrations({
      ...integrations,
      xero: {
        connected: true,
        name: "Xero Accounting",
        icon: "🧾",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        tenant_id: account.tenantId,
        tenant_name: account.tenantName,
        integratedAt: new Date().toISOString(),
      },
    });

    const response = NextResponse.redirect(`${appUrl}/integrations?xero_success=true`);
    response.cookies.delete("xero_oauth_state");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "xero_oauth_failed";
    return NextResponse.redirect(`${appUrl}/integrations?xero_error=${encodeURIComponent(message)}`);
  }
}

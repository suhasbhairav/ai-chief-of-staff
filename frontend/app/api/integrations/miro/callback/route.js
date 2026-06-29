import { NextResponse } from "next/server";
import {
  exchangeMiroOAuthCode,
  getMiroCredentials,
  validateMiroToken,
} from "@/lib/miro/server";
import { readIntegrations, writeIntegrations } from "@/lib/current-data-store";
import { getAppUrl } from "@/lib/slack/server";

export async function GET(request) {
  const appUrl = getAppUrl(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get("miro_oauth_state")?.value;
  const { clientId, clientSecret } = getMiroCredentials();

  try {
    if (!code) {
      return NextResponse.redirect(`${appUrl}/integrations?miro_error=missing_code`);
    }
    if (!state || !expectedState || state !== expectedState) {
      return NextResponse.redirect(`${appUrl}/integrations?miro_error=invalid_oauth_state`);
    }
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${appUrl}/integrations?miro_error=missing_credentials`);
    }

    const redirectUri = `${appUrl}/api/integrations/miro/callback`;
    const tokenData = await exchangeMiroOAuthCode({
      clientId,
      clientSecret,
      code,
      redirectUri,
    });
    const account = await validateMiroToken(tokenData.access_token);
    const integrations = await readIntegrations();
    await writeIntegrations({
      ...integrations,
      miro: {
        connected: true,
        name: "Miro Boards",
        icon: "🧩",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        first_board_name: account.firstBoardName,
        integratedAt: new Date().toISOString(),
      },
    });

    const response = NextResponse.redirect(`${appUrl}/integrations?miro_success=true`);
    response.cookies.delete("miro_oauth_state");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "miro_oauth_failed";
    return NextResponse.redirect(`${appUrl}/integrations?miro_error=${encodeURIComponent(message)}`);
  }
}

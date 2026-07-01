import { NextResponse } from "next/server";
import {
  exchangeClickUpOAuthCode,
  createClickUpAuthHeader,
  getClickUpCredentials,
  validateClickUpToken,
} from "@/lib/clickup/server";
import { readIntegrations, writeIntegrations } from "@/lib/current-data-store";
import { getAppUrl } from "@/lib/slack/server";

export async function GET(request) {
  const appUrl = getAppUrl(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get("clickup_oauth_state")?.value;
  const { clientId, clientSecret } = getClickUpCredentials();

  try {
    if (!code) {
      return NextResponse.redirect(`${appUrl}/integrations?clickup_error=missing_code`);
    }
    if (!state || !expectedState || state !== expectedState) {
      return NextResponse.redirect(`${appUrl}/integrations?clickup_error=invalid_oauth_state`);
    }
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${appUrl}/integrations?clickup_error=missing_credentials`);
    }

    const redirectUri = `${appUrl}/api/integrations/clickup/callback`;
    const tokenData = await exchangeClickUpOAuthCode({
      clientId,
      clientSecret,
      code,
      redirectUri,
    });
    const account = await validateClickUpToken(
      createClickUpAuthHeader(tokenData.access_token, { oauth: true })
    );
    const workspace = account.workspaces[0];
    const integrations = await readIntegrations();
    await writeIntegrations({
      ...integrations,
      clickup: {
        connected: true,
        name: "ClickUp Workspace",
        icon: "☑️",
        access_token: tokenData.access_token,
        workspace_id: workspace?.id ? String(workspace.id) : account.workspaceId,
        workspace_name: workspace?.name || account.workspaceName,
        user_name: account.user?.username || account.user?.email,
        integratedAt: new Date().toISOString(),
      },
    });

    const response = NextResponse.redirect(`${appUrl}/integrations?clickup_success=true`);
    response.cookies.delete("clickup_oauth_state");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "clickup_oauth_failed";
    return NextResponse.redirect(`${appUrl}/integrations?clickup_error=${encodeURIComponent(message)}`);
  }
}

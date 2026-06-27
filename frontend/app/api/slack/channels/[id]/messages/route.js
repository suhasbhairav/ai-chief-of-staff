import { NextResponse } from "next/server";
import {
  readActiveSlackInstallation,
  saveSlackMessageSnapshots,
  slackApi,
} from "@/lib/slack/server";

export async function GET(_request, { params }) {
  try {
    const { id: channelId } = await params;
    const installation = await readActiveSlackInstallation();
    const botToken = installation?.bot_access_token;

    if (!botToken) {
      return NextResponse.json({ error: "Slack not integrated" }, { status: 400 });
    }

    let data;
    try {
      data = await slackApi("conversations.history", botToken, {
        channel: channelId,
        limit: 40,
        include_all_metadata: true,
      }, {
        httpMethod: "GET",
      });
    } catch (error) {
      if (error.slack?.error !== "not_in_channel") {
        throw error;
      }

      await slackApi("conversations.join", botToken, { channel: channelId });
      data = await slackApi("conversations.history", botToken, {
        channel: channelId,
        limit: 40,
        include_all_metadata: true,
      }, {
        httpMethod: "GET",
      });
    }

    await saveSlackMessageSnapshots({
      teamId: installation.team_id,
      channelId,
      messages: data.messages || [],
    });

    // Return messages in standard format
    return NextResponse.json({
      messages: (data.messages || []).map((m) => ({
        id: m.client_msg_id || m.ts,
        sender: m.user || (m.bot_id ? "ChiefStaff AI" : "System"),
        avatar: m.bot_id ? "👑" : "👤",
        time: new Date(parseFloat(m.ts) * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        text: m.text || "",
        isAgent: Boolean(m.bot_id)
      })).reverse() // reverse to show oldest first in chat flow
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Slack channel messages GET failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id: channelId } = await params;
    const { text } = await request.json();
    const installation = await readActiveSlackInstallation();
    const botToken = installation?.bot_access_token;

    if (!botToken) {
      return NextResponse.json({ error: "Slack not integrated" }, { status: 400 });
    }

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Message text is empty" }, { status: 400 });
    }

    const data = await slackApi("chat.postMessage", botToken, {
      channel: channelId,
      text
    });

    return NextResponse.json({
      success: true,
      message: data.message
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Slack channel messages POST failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

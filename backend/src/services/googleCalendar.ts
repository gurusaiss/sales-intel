import { getValidAccessToken } from "./gmail";

export interface CreateEventInput {
  summary: string;
  description?: string;
  startIso: string;
  durationMinutes: number;
  attendeeEmail?: string;
}

export interface CreateEventResult {
  eventId: string;
  htmlLink: string;
  meetLink?: string;
}

/**
 * Creates a real Google Calendar event using the same OAuth grant as Gmail
 * send — free (no billing, standard Calendar API quota), and only ever
 * triggered by an explicit "Schedule meeting" click, never automatically.
 */
export async function createCalendarEvent(
  userId: string,
  input: CreateEventInput
): Promise<CreateEventResult> {
  const accessToken = await getValidAccessToken(userId);
  const start = new Date(input.startIso);
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);

  const body: Record<string, unknown> = {
    summary: input.summary,
    description: input.description,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    attendees: input.attendeeEmail ? [{ email: input.attendeeEmail }] : undefined,
    conferenceData: {
      createRequest: { requestId: `sales-intel-${Date.now()}` },
    },
  };

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    throw new Error(`Calendar event creation failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    id: string;
    htmlLink: string;
    conferenceData?: { entryPoints?: Array<{ entryPointType: string; uri: string }> };
  };

  const meetLink = data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri;

  return { eventId: data.id, htmlLink: data.htmlLink, meetLink };
}

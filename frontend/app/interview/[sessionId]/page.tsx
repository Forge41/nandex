import { InterviewRoom } from "@/components/interview/interview-room";
import { InterviewSessionProvider } from "@/lib/interview/session-provider";
import { RoomShell } from "@/components/interview/room-shell";
import { MOCK_SESSION, MOCK_TRANSCRIPT } from "@/lib/interview/mock/session.fixture";

/** The fixture stands in for GET /api/interview/:id. When the endpoint lands,
 * this is the only place that changes. */
export default async function InterviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = { ...MOCK_SESSION, id: sessionId };

  return (
    <InterviewSessionProvider initialSession={session}>
      <RoomShell transcript={MOCK_TRANSCRIPT}>
        <InterviewRoom />
      </RoomShell>
    </InterviewSessionProvider>
  );
}

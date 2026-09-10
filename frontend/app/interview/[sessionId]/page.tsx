import { InterviewRoom } from "@/components/interview/interview-room";
import { InterviewSessionProvider } from "@/lib/interview/session-provider";
import { RoomProvider } from "@/lib/interview/room-provider";
import { MOCK_SESSION, MOCK_TRANSCRIPT } from "@/lib/interview/mock/session.fixture";

/** The fixture stands in for GET /api/interview/:id. When the endpoint lands,
 * this is the only place that changes. */
export default async function InterviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = { ...MOCK_SESSION, id: sessionId };

  return (
    <InterviewSessionProvider initialSession={session}>
      <RoomProvider>
        <InterviewRoom transcript={MOCK_TRANSCRIPT} />
      </RoomProvider>
    </InterviewSessionProvider>
  );
}

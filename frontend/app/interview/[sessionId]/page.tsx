import { InterviewSessionLoader } from "@/components/interview/interview-session-loader";

/** The session is fetched in the browser, not here.
 *
 * A candidate's identity is their session cookie, and the anonymous one is
 * minted on their first request -- so a server-side fetch would either carry no
 * cookie or mint a second identity that owns nothing. */
export default async function InterviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  return <InterviewSessionLoader sessionId={sessionId} />;
}

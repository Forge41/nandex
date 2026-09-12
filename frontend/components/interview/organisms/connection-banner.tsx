"use client";

import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { useRoomState } from "@/lib/interview/room-provider";
import { deriveConnectionView } from "@/lib/interview/selectors";

/** What the room is actually doing, said plainly.
 *
 * Shown only where a room is joined. A round that connects nothing renders
 * nothing here rather than an empty reassurance. */
export function ConnectionBanner() {
  const room = useRoomState();
  const view = deriveConnectionView(room.connection, room.agentState);

  if (!view) return null;

  return (
    <Banner tone={view.tone} className="mx-7 mt-4">
      <span className="flex-1">{view.message}</span>
      {view.canRetry && (
        <Button variant="secondary" size="xs" onClick={room.retry}>
          Retry
        </Button>
      )}
      {view.canUnblockAudio && (
        <Button variant="primary" size="xs" onClick={room.unblockAudio}>
          Enable sound
        </Button>
      )}
    </Banner>
  );
}

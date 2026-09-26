"use client";

import dynamic from "next/dynamic";

/** Client-only: boot state, the clock, media queries and the URL hash all differ from anything a server render could know. */
export const Terminal = dynamic(() => import("./terminal"), {
  ssr: false,
  loading: () => <div className="fixed inset-0" style={{ background: "hsl(30 7% 5%)" }} />,
});

import { notFound } from "next/navigation";

/** The harnesses do not exist in a production build.
 *
 * They ship fixtures -- a plausible candidate with a name, an email and an
 * employment history -- and a page that renders those at a public URL is a page that
 * looks like it is showing someone's data. The backend bypass is already absent
 * unless DEBUG is on; this is the frontend's own guard, because a Next route is not
 * covered by that one.
 */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}

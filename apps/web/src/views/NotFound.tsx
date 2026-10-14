import { EmptyState } from "@adlab/ui";
import { Link } from "react-router";

export function NotFound() {
  return (
    <EmptyState
      title="No such page"
      description="The link may be stale, or the page was renamed."
      action={
        <Link to="/" className="link text-sm">
          Back to overview
        </Link>
      }
    />
  );
}

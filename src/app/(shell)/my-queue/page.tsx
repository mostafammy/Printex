import ar from "../../../../messages/ar.json";

// Placeholder "My queue" landing page — spec.md FR-014, tasks.md T033.
// No real business content yet; this only proves the shell/nav wiring.
export default function MyQueuePage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-xl font-semibold">{ar.ui.myQueuePageTitle}</h1>
      <p className="text-muted-foreground">{ar.ui.myQueuePagePlaceholder}</p>
    </div>
  );
}

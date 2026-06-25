import { Badge } from "@/components/ui/badge";

/** Compact row of supplier signals: a "new reply waiting" pill + AI/manual tags.
 *  Renders nothing when there is no signal. Pure presentational (server-safe). */
export function SupplierSignals({
  newReply,
  tags,
  className,
}: {
  newReply?: boolean;
  tags?: { name: string }[];
  className?: string;
}) {
  if (!newReply && (!tags || tags.length === 0)) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className ?? ""}`}>
      {newReply ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
          <span className="text-[10px] leading-none">●</span> Новый ответ
        </span>
      ) : null}
      {tags?.map((t) => (
        <Badge key={t.name} status={t.name}>
          {t.name}
        </Badge>
      ))}
    </div>
  );
}

/** True when the supplier's latest thread is an unanswered inbound reply. */
export function hasNewReply(
  threads: { lastDirection: string | null; isClosed: boolean }[] | undefined
): boolean {
  return !!threads?.some((t) => t.lastDirection === "INBOUND" && !t.isClosed);
}

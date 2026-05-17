import { File, FileBox, FileText, Image as ImageIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import type { PublicAttachmentItem } from "@/lib/db/queries/public";
import { relativeFromNow } from "@/lib/utils/date";
import { formatBytes, mimeCategory } from "@/lib/utils/file";

const ICON_MAP = {
  FileText,
  Image: ImageIcon,
  FileBox,
  File,
} as const;

export function PublicAttachmentsList({
  attachments,
  token,
}: {
  attachments: PublicAttachmentItem[];
  token: string;
}): React.JSX.Element {
  return (
    <section className="mb-9">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display text-lg text-ink font-semibold">Anexos</h2>
        <Pill variant="neutral">{attachments.length}</Pill>
      </div>

      {attachments.length === 0 ? (
        <Card>
          <p className="text-sm text-mute text-center py-2">
            Nenhum anexo disponível.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {attachments.map((a) => (
            <Row key={a.id} attachment={a} token={token} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({
  attachment,
  token,
}: {
  attachment: PublicAttachmentItem;
  token: string;
}) {
  const cat = mimeCategory(attachment.mimeType);
  const Icon = ICON_MAP[cat.icon];
  return (
    <li className="bg-card border border-line rounded px-4 py-3 flex items-center gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded bg-surface flex items-center justify-center text-mute">
        <Icon className="w-4 h-4" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={`/public/${token}/attachments/${attachment.id}/download`}
            className="font-body text-sm text-ink hover:underline truncate"
          >
            {attachment.filename}
          </a>
          <Pill variant="neutral">{cat.label}</Pill>
        </div>
        {attachment.description && (
          <p className="text-xs text-mute mt-0.5 line-clamp-1">
            {attachment.description}
          </p>
        )}
        <p className="font-mono text-[10px] text-mute-soft mt-0.5">
          {formatBytes(attachment.sizeBytes)} ·{" "}
          {relativeFromNow(attachment.createdAt)}
        </p>
      </div>
    </li>
  );
}

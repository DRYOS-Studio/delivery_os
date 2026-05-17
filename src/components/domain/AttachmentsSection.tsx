import { File, FileBox, FileText, Image as ImageIcon } from "lucide-react";
import { AttachmentUploadForm } from "@/components/domain/AttachmentUploadForm";
import { DeleteAttachmentButton } from "@/components/domain/DeleteAttachmentButton";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import type { AttachmentListItem } from "@/lib/db/queries/attachments";
import { relativeFromNow } from "@/lib/utils/date";
import { formatBytes, mimeCategory } from "@/lib/utils/file";

const ICON_MAP = {
  FileText,
  Image: ImageIcon,
  FileBox,
  File,
} as const;

type Props = {
  attachments: AttachmentListItem[];
  operationId: string;
  meetingId?: string | undefined;
  // override do título; default "Anexos" pra Op, "Anexos da reunião" se meetingId
  title?: string;
};

export function AttachmentsSection({
  attachments,
  operationId,
  meetingId,
  title,
}: Props): React.JSX.Element {
  const headingText =
    title ?? (meetingId ? "Anexos da reunião" : "Anexos");

  return (
    <section className="mb-9">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-display text-lg text-ink font-semibold">
          {headingText}
        </h2>
        <Pill variant="neutral">{attachments.length}</Pill>
      </div>

      <div className="space-y-4">
        <AttachmentUploadForm
          operationId={operationId}
          meetingId={meetingId}
        />

        {attachments.length === 0 ? (
          <Card>
            <p className="text-sm text-mute text-center py-2">
              Nenhum anexo. Suba um arquivo no formulário acima.
            </p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {attachments.map((a) => (
              <AttachmentRow key={a.id} attachment={a} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function AttachmentRow({
  attachment,
}: {
  attachment: AttachmentListItem;
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
            href={`/api/attachments/${attachment.id}/download`}
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
          {attachment.uploaderEmail && <> · {attachment.uploaderEmail}</>}
        </p>
      </div>
      <DeleteAttachmentButton
        attachmentId={attachment.id}
        filename={attachment.filename}
      />
    </li>
  );
}

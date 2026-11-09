"use client";

import { ProfileDisplayNameForm } from "@/components/domain/ProfileDisplayNameForm";

type Props = {
  profileId: string;
  initialName: string | null;
  resolvedLabel: string | null;
  email: string | null;
};

export function ProfileDisplayNameControl({
  profileId,
  initialName,
  resolvedLabel,
  email,
}: Props): React.JSX.Element {
  return (
    <ProfileDisplayNameForm
      profileId={profileId}
      initialName={initialName}
      resolvedLabel={resolvedLabel}
      email={email}
      canEdit
      compact
    />
  );
}

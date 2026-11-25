"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const MeetingForm = dynamic(
  () =>
    import("@/components/domain/MeetingForm").then((mod) => mod.MeetingForm),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-mute" role="status">
        Carregando formulário…
      </p>
    ),
  },
);

export type MeetingFormDynamicProps = ComponentProps<typeof MeetingForm>;

/** Evita mismatch de hydration em `datetime-local` (SSR UTC vs browser local). */
export function MeetingFormDynamic(props: MeetingFormDynamicProps): React.JSX.Element {
  return <MeetingForm {...props} />;
}
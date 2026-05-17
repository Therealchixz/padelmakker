import type { ReactNode } from 'react';

export type ReportResultErrorButtonProps = {
  sourceType: string;
  entityId: string;
  completedAtMs: number | null;
  isCreator: boolean;
  entityLabel?: string;
  onSubmitted?: () => void;
};

export function ReportResultErrorButton(props: ReportResultErrorButtonProps): ReactNode;

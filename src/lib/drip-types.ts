/** Shapes the admin panel reads. Kept out of the .server module so the UI can
 *  import them without pulling server code into the client bundle. */
export type ExclusionCounts = {
  deceased_archived: number;
  no_email: number;
  suppressed: number;
  already_sent: number;
  recent_send: number;
  null_body: number;
};

export type DripRecipient = { personId: string; name: string; email: string };

export type DripSequenceReport = {
  id: string;
  key: string;
  offsetDays: number;
  dueDate: string;
  due: boolean;
  hasCopy: boolean;
  note: string;
  audienceStates: string[];
  anchorsOnly: boolean;
  eligible: number;
  excluded: ExclusionCounts;
  /** First ten only, admin eyes only. */
  sample: DripRecipient[];
  sent: number;
  failed: number;
};

export type DripRunReport = {
  dryRun: boolean;
  today: string;
  anchorDate: string;
  outboundMode: string;
  outboundSentence: string;
  outboundPaused: boolean;
  totalEligible: number;
  totalSent: number;
  stoppedReason: string | null;
  sequences: DripSequenceReport[];
};


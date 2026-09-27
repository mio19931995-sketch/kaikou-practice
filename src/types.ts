export type RuleProfile =
  "auto" | "general" | "report" | "interview" | "persuade" | "retell";
export type Mode = "improv" | "logic" | "retell";
export type Feedback = {
  source: "ai" | "basic";
  provider?: "jev" | "agnes";
  answerGuide?: string;
  model?: string;
  ruleVersion?: string;
  ruleProfile?: RuleProfile;
  profileName?: string;
  practiceTarget?: string;
  checks?: {
    id: string;
    title: string;
    outcome: string;
    text: string;
    task: string;
    evidence: string;
  }[];
  judgments?: Record<
    string,
    {
      type: "choice";
      choice: string;
      confidence: number;
      probabilities: Record<string, number>;
    }
  >;
  summary: string;
  dimensions: {
    title: string;
    text: string;
    id?: string;
    status?: "good" | "partial" | "missing" | "unsure";
    evidence?: string[];
    advice?: string;
    standard?: string;
  }[];
  improvements: string[];
  rewrite: string;
  metrics: { characters: number; duration: number; fillers: number };
};
export type Session = {
  retryOf?: string;
  practiceFocus?: string;
  thinkingModelId?: string;
  targetDuration?: number;
  preparationDraft?: string;
  id: string;
  createdAt: string;
  mode: Mode;
  topic: string;
  transcript: string;
  duration: number;
  framework?: string;
  material?: string;
  lessonDay?: number;
  feedback?: Feedback;
  previousAttempt?: { transcript: string; feedback: Feedback };
  ruleProfile?: RuleProfile;
  audio?: Blob;
};
export type ServiceStatus = {
  ai: boolean;
  asr: boolean;
  reachable: boolean;
  asrMode?: "local" | "unavailable";
};

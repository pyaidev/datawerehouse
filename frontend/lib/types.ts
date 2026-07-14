export type SourceDefinition = {
  title: string;
  endpoint: string;
  collection: string;
  entity: string;
};

export type SourcesResponse = Record<string, SourceDefinition>;

export type QualityCheck = {
  name: string;
  passed: boolean;
  value: string;
};

export type StageResult = {
  id: string;
  name: string;
  status: "done" | "warning" | "error";
  duration_ms: number;
  message: string;
  warnings: string[];
  input_ref?: string | null;
  output_ref?: string | null;
  input_preview?: unknown;
  output_preview?: unknown;
  metrics?: Record<string, unknown>;
  artifacts?: Record<string, unknown>;
};

export type PipelineResult = {
  run_id: string;
  source: string;
  mode: string;
  records: number;
  quality_score: number;
  curated_fields: number;
  stages: StageResult[];
  quality_checks: QualityCheck[];
  warnings: string[];
  raw_preview: Record<string, unknown>[];
  curated_preview: Record<string, unknown>[];
};

export type HealthResponse = {
  status: string;
  environment: string;
};

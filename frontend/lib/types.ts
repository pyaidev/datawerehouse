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
  sequence: number;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  data_size_bytes: number;
  data_format: string;
  message: string;
  warnings: string[];
  input_ref?: string | null;
  output_ref?: string | null;
  input_preview?: unknown;
  output_preview?: unknown;
  metrics?: Record<string, unknown>;
  artifacts?: Record<string, unknown>;
};

export type ManualCorrection = {
  record_id: string;
  column: string;
  value: unknown;
};

export type LineageRecord = {
  record_id: string;
  source: Record<string, unknown>;
  raw: Record<string, unknown>;
  prepared: Record<string, unknown> | null;
  curated: Record<string, unknown> | null;
  warehouse: Record<string, unknown> | null;
};

export type PipelineResult = {
  run_id: string;
  source: string;
  mode: string;
  status: "done" | "warning" | "error";
  started_at: string;
  finished_at: string;
  duration_ms: number;
  failed_stage: string | null;
  records: number;
  quality_score: number;
  curated_fields: number;
  stages: StageResult[];
  quality_checks: QualityCheck[];
  warnings: string[];
  raw_preview: Record<string, unknown>[];
  prepared_preview: Record<string, unknown>[];
  curated_preview: Record<string, unknown>[];
  lineage: LineageRecord[];
};

export type HealthResponse = {
  status: string;
  environment: string;
};

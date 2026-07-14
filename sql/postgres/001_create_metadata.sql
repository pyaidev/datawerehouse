CREATE TABLE IF NOT EXISTS pipeline_runs (
    run_id text PRIMARY KEY,
    source text NOT NULL,
    mode text NOT NULL,
    status text NOT NULL,
    records integer NOT NULL,
    quality_score integer NOT NULL,
    warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_lineage_events (
    id bigserial PRIMARY KEY,
    run_id text NOT NULL REFERENCES pipeline_runs(run_id) ON DELETE CASCADE,
    stage text NOT NULL,
    input_ref text,
    output_ref text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_runs_source_created_at
ON pipeline_runs(source, created_at DESC);

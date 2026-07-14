CREATE DATABASE IF NOT EXISTS dwh;

CREATE TABLE IF NOT EXISTS dwh.curated_events
(
    dw_id String,
    run_id String,
    source_system String,
    source_entity String,
    ingestion_mode String,
    loaded_at DateTime64(3, 'UTC'),
    entity_name Nullable(String),
    category Nullable(String),
    metric_name String,
    metric_value Float64,
    status String
)
ENGINE = MergeTree
ORDER BY (source_entity, dw_id);

CREATE TABLE IF NOT EXISTS dwh.source_metric_daily
(
    source_entity String,
    category String,
    metric_name String,
    load_date Date,
    record_count UInt64,
    metric_sum Float64,
    metric_avg Float64,
    last_loaded_at DateTime64(3, 'UTC')
)
ENGINE = MergeTree
ORDER BY (source_entity, metric_name, load_date, category);

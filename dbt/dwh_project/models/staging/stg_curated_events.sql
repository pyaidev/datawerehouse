select
    dw_id,
    run_id,
    source_system,
    source_entity,
    ingestion_mode,
    loaded_at,
    entity_name,
    category,
    metric_name,
    metric_value,
    status
from {{ source('warehouse', 'curated_events') }}

select
    source_entity,
    category,
    metric_name,
    toDate(loaded_at) as load_date,
    count() as record_count,
    sum(metric_value) as metric_sum,
    avg(metric_value) as metric_avg,
    max(loaded_at) as last_loaded_at
from {{ ref('stg_curated_events') }}
group by
    source_entity,
    category,
    metric_name,
    load_date

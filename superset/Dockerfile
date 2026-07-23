FROM apache/superset:6.0.0

USER root
RUN uv pip install --python /app/.venv/bin/python "clickhouse-connect>=0.8.11,<1.0"
COPY superset_config.py /app/pythonpath/superset_config.py
COPY bootstrap_public.py /app/pythonpath/bootstrap_public.py
RUN mkdir -p /app/superset_home && chown -R superset:superset /app/superset_home /app/pythonpath
USER superset
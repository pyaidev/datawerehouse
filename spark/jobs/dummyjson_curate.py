import argparse
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F


def build_spark(app_name: str) -> SparkSession:
    return (
        SparkSession.builder.appName(app_name)
        .config("spark.sql.session.timeZone", "UTC")
        .getOrCreate()
    )


def add_common_columns(df: DataFrame, source: str, source_system: str, mode: str, run_id: str) -> DataFrame:
    return (
        df.withColumn("dw_id", F.concat(F.lit(f"{source}_"), F.col("id").cast("string")))
        .withColumn("run_id", F.lit(run_id))
        .withColumn("source_system", F.lit(source_system))
        .withColumn("source_entity", F.lit(source))
        .withColumn("ingestion_mode", F.lit(mode))
        .withColumn("loaded_at", F.current_timestamp())
    )


def curate(df: DataFrame, source: str, source_system: str, mode: str, run_id: str) -> DataFrame:
    df = add_common_columns(df, source, source_system, mode, run_id)

    if source == "products":
        return df.select(
            "dw_id",
            "run_id",
            "source_system",
            "source_entity",
            "ingestion_mode",
            "loaded_at",
            F.col("title").alias("entity_name"),
            F.col("category").cast("string").alias("category"),
            F.lit("price").alias("metric_name"),
            F.coalesce(F.col("price").cast("double"), F.lit(0.0)).alias("metric_value"),
            F.coalesce(F.col("availabilityStatus"), F.lit("active")).alias("status"),
        )

    if source == "users":
        return df.select(
            "dw_id",
            "run_id",
            "source_system",
            "source_entity",
            "ingestion_mode",
            "loaded_at",
            F.concat_ws(" ", F.col("firstName"), F.col("lastName")).alias("entity_name"),
            F.coalesce(F.col("company.department"), F.col("role"), F.lit("user")).cast("string").alias("category"),
            F.lit("age").alias("metric_name"),
            F.coalesce(F.col("age").cast("double"), F.lit(0.0)).alias("metric_value"),
            F.when(F.col("email").isNotNull(), F.lit("verified")).otherwise(F.lit("missing_email")).alias("status"),
        )

    if source == "carts":
        return df.select(
            "dw_id",
            "run_id",
            "source_system",
            "source_entity",
            "ingestion_mode",
            "loaded_at",
            F.concat(F.lit("Cart "), F.col("id").cast("string")).alias("entity_name"),
            F.concat(F.lit("user_"), F.col("userId").cast("string")).alias("category"),
            F.lit("total").alias("metric_name"),
            F.coalesce(F.col("total").cast("double"), F.lit(0.0)).alias("metric_value"),
            F.concat(F.coalesce(F.col("totalProducts").cast("string"), F.lit("0")), F.lit(" products")).alias("status"),
        )

    for column in ["title", "todo", "quote", "userId", "completed"]:
        if column not in df.columns:
            df = df.withColumn(column, F.lit(None))

    name_col = F.coalesce(F.col("title"), F.col("todo"), F.col("quote"), F.concat(F.lit("Record "), F.col("id").cast("string")))
    category_col = F.coalesce(F.col("userId").cast("string"), F.lit("general"))

    return df.select(
        "dw_id",
        "run_id",
        "source_system",
        "source_entity",
        "ingestion_mode",
        "loaded_at",
        name_col.alias("entity_name"),
        category_col.alias("category"),
        F.lit("generic_value").alias("metric_name"),
        F.when(F.col("completed") == True, F.lit(1.0)).otherwise(F.lit(0.0)).alias("metric_value"),
        F.when(F.col("completed") == True, F.lit("completed")).otherwise(F.lit("active")).alias("status"),
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--source-system", required=True)
    parser.add_argument("--mode", default="batch")
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--input", required=True, help="Raw JSON path, local/S3A/HDFS")
    parser.add_argument("--output", required=True, help="Curated Parquet output path")
    args = parser.parse_args()

    spark = build_spark(f"dwh-curate-{args.source}")
    try:
        raw = spark.read.option("multiline", "true").json(args.input)
        curated = curate(raw, args.source, args.source_system, args.mode, args.run_id)
        curated.write.mode("overwrite").parquet(args.output)
        print(f"Wrote curated parquet to {args.output}; rows={curated.count()}")
    finally:
        spark.stop()


if __name__ == "__main__":
    main()


$env:RUN_ID = if ($env:RUN_ID) { $env:RUN_ID } else { [guid]::NewGuid().ToString() }
spark-submit `
  spark/jobs/dummyjson_curate.py `
  --source products `
  --source-system "eStat 4.0" `
  --mode batch `
  --run-id $env:RUN_ID `
  --input data/artifacts/raw-zone/products/$env:RUN_ID/raw.json `
  --output data/curated/products/$env:RUN_ID

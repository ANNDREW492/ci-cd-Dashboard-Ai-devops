Model artifact handling

Where to place the trained CatBoost v3 model

- Place the trained binary file named `catboost_despliegues_v3.cbm` under the `ai-service/` directory.
- Do NOT commit the binary to git. It's ignored by `.gitignore` (`ai-service/*.cbm`).

Recommended storage and CI options

1) GitHub Release / Release Asset
- Upload the trained model as a release asset.
- In CI, download it using `actions/download-artifact` or `curl` from the release URL with a token.

2) Object Storage (S3, MinIO, GCS)
- Upload the model to a private bucket.
- In CI, download it during the job using `aws s3 cp` or `gsutil cp` with credentials stored in secrets.

3) Git LFS (not recommended for very large models unless your org allows it)

CI snippet examples

# Download from S3 (example)

```yaml
- name: Download model from S3
  run: |
    aws s3 cp s3://mi-bucket-models/catboost_despliegues_v3.cbm ./ai-service/catboost_despliegues_v3.cbm
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

# Download from GitHub Release (example)

```yaml
- name: Download model from release
  run: |
    curl -L -H "Authorization: token ${{ secrets.GITHUB_TOKEN }}" -o ./ai-service/catboost_despliegues_v3.cbm "https://github.com/<OWNER>/<REPO>/releases/download/<TAG>/catboost_despliegues_v3.cbm"
```

Local development

- To run locally for development, place the file in `ai-service/` or set `CATBOOST_V3_PATH` env var to an absolute path.

Verification

- The FastAPI health endpoint `/` returns `ml_status` describing whether the model was loaded and from where.

Notes

- Keep the model artifact secure and treat it as a sensitive binary. Store checksums if you need integrity checks.

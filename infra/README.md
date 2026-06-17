# FitA11y Infrastructure Configuration

This directory contains the AWS CloudFormation templates defining the infrastructure resources for the FitA11y application.

## Development Storage Stack

The `cloudformation/storage-dev.yaml` template defines:
1. **S3 Bucket**: `fita11y-dev-artifacts-905418181041` (Fully private, Block Public Access enabled, SSE-S3 encrypted).
2. **DynamoDB Tables** (PAY_PER_REQUEST billing):
   - `FitA11y-dev-Users` (Partition Key: `user_id`)
   - `FitA11y-dev-Jobs` (Partition Key: `video_id`, GSI: `LibraryPartitionCreatedAtIndex` on `library_partition` & `created_at`)
   - `FitA11y-dev-Sessions` (Partition Key: `session_id`, GSI: `UserIdStartedAtIndex` on `user_id` & `started_at`)
   - `FitA11y-dev-SessionEvents` (Partition Key: `session_id`, Sort Key: `event_key`)

---

## Instructions

These commands should be run from the **repository root directory**.

> [!NOTE]
> On Windows PowerShell, if the standard `aws` command is not in your system environment PATH but is installed, you can execute it by specifying the absolute path (e.g. prefix with `& "C:\Program Files\Amazon\AWSCLIV2\aws.exe"`).

### 1. Validate Template Syntax

Run the following command from the repository root to validate the stack template syntax:

```bash
aws cloudformation validate-template \
    --template-body file://infra/cloudformation/storage-dev.yaml \
    --profile fita11y-dev \
    --region us-east-2
```

### 2. Deploy Storage Stack

Run the following command from the repository root to deploy or update the stack resources in the `us-east-2` region:

```bash
aws cloudformation deploy \
    --template-file infra/cloudformation/storage-dev.yaml \
    --stack-name fita11y-dev-storage \
    --profile fita11y-dev \
    --region us-east-2 \
    --no-fail-on-empty-changeset
```

## Storage Architecture

FitA11y splits database responsibility across two primary AWS storage services:
1. **DynamoDB**: Stores structured, queryable application runtime data:
   - **Users**: User profiles and accessibility settings.
   - **Jobs**: Preprocessing pipeline progress state.
   - **Sessions**: Workout session master records.
   - **SessionEvents**: Granular, time-series telemetry events (reps, form warnings, playback actions) recorded during workouts, dynamically compiled at read-time.
2. **S3**: Stores larger, static generated JSON artifacts:
   - **Sidecar Manifests**: `manifests/{video_id}.json` containing analyzed workout structures.
   - **Cue Plans**: `cue-plans/{video_id}.json` detailing proposed guidance candidates.
   - **Developer Diagnostics**: `diagnostics/sidecar/{video_id}.json` and `diagnostics/cue-plan/{video_id}.json` summarizing validation results.

---

## AWS Dev Mode Manual Smoke Verification Checklist

Follow these steps to verify that the DynamoDB/S3 storage migration integrations are functioning correctly:

### 1. Verify CloudFormation Stack
Ensure the stack is deployed and the resources are active:
```bash
aws cloudformation describe-stacks \
    --stack-name fita11y-dev-storage \
    --profile fita11y-dev \
    --region us-east-2
```

### 2. Configure Local Environment
Modify your `backend/.env` file with the following settings:
```env
STORAGE_PROVIDER=dynamodb
AWS_PROFILE=fita11y-dev
AWS_REGION=us-east-2
DYNAMODB_USERS_TABLE=FitA11y-dev-Users
DYNAMODB_JOBS_TABLE=FitA11y-dev-Jobs
DYNAMODB_SESSIONS_TABLE=FitA11y-dev-Sessions
DYNAMODB_SESSION_EVENTS_TABLE=FitA11y-dev-SessionEvents
ARTIFACTS_BUCKET=fita11y-dev-artifacts-905418181041
```

### 3. Start Backend & Run Health Check
Start the FastAPI server:
```bash
cd backend
python -m uvicorn app.main:app --reload --log-level debug
```
Perform a basic health check:
```bash
curl http://localhost:8000/health
```
*(Verify it returns `{"status":"ok"}` or similar HTTP 200 response).*

### 4. Fetch/Register Prototype User
Retrieve the default prototype user (`00000000-0000-0000-0000-000000000001`):
```bash
curl http://localhost:8000/api/user/00000000-0000-0000-0000-000000000001
```
If it returns a `404` (not found), register the user via a `POST` request:
```bash
curl -X POST http://localhost:8000/api/user/register \
     -H "Content-Type: application/json" \
     -d '{
       "id": "00000000-0000-0000-0000-000000000001",
       "name": "Prototype User",
       "settings": {
         "assistant_persona": "friendly",
         "assistant_voice": "en-US-Standard-C",
         "audio_coexistence": "brief_speech",
         "haptic_intensity": 1.0,
         "mute_assistant": false,
         "speech_ducking_volume": 0.3,
         "speech_speed": 1.0,
         "use_haptic_vibrations": true
       }
     }'
```
Scan the DynamoDB `FitA11y-dev-Users` table to confirm the row exists:
```bash
aws dynamodb scan \
    --table-name FitA11y-dev-Users \
    --profile fita11y-dev \
    --region us-east-2
```

### 5. Submit Preprocessing Job
Submit a YouTube workout video URL:
```bash
curl -X POST http://localhost:8000/api/preprocessing/submit \
     -H "Content-Type: application/json" \
     -d '{"url": "https://youtube.com/watch?v=12345678901"}'
```
*(Copy the `video_id` returned in the JSON response).*

### 6. Verify Job & Artifact Storage
Check the DynamoDB `FitA11y-dev-Jobs` table to verify the job metadata row is registered:
```bash
aws dynamodb scan \
    --table-name FitA11y-dev-Jobs \
    --profile fita11y-dev \
    --region us-east-2
```
Verify the job status endpoint:
```bash
curl http://localhost:8000/api/preprocessing/status/<video_id>
```
Wait until status is `Completed`, then list S3 objects to confirm that the generated manifest, cue plan, and developer diagnostics files were uploaded to S3:
```bash
aws s3 ls s3://fita11y-dev-artifacts-905418181041/ --profile fita11y-dev --region us-east-2 --recursive
```
Ensure the following keys exist in S3:
* `manifests/<video_id>.json`
* `cue-plans/<video_id>.json`
* `diagnostics/sidecar/<video_id>.json`
* `diagnostics/cue-plan/<video_id>.json`

### 7. Run a Workout Session & Verify History Persistence
- Access the web interface, log in as `Prototype User`, select the imported video, and complete a workout session.
- Stop the FastAPI backend server (`Ctrl+C`).
- Restart the backend server.
- Request the user history list:
  ```bash
  curl http://localhost:8000/api/user/00000000-0000-0000-0000-000000000001/history
  ```
  *(Verify that the completed workout session metadata and stats are successfully retrieved from the DynamoDB `FitA11y-dev-Sessions` table).*

### 8. Inspect Live Session Events in DynamoDB
When a session is active, event telemetry is written to DynamoDB. You can query session details and event records:

**Retrieve Session Record:**
* Standard Bash:
  ```bash
  aws dynamodb get-item \
      --table-name FitA11y-dev-Sessions \
      --key '{"session_id":{"S":"<session_id>"}}' \
      --profile fita11y-dev \
      --region us-east-2
  ```
* Windows PowerShell:
  ```powershell
  aws dynamodb get-item \
      --table-name FitA11y-dev-Sessions \
      --key "{\`"session_id\`":{\`"S\`":\`"<session_id>\`"}}" \
      --profile fita11y-dev \
      --region us-east-2
  ```

**Retrieve Live Telemetry Events:**
* Standard Bash:
  ```bash
  aws dynamodb query \
      --table-name FitA11y-dev-SessionEvents \
      --key-condition-expression "session_id = :sid" \
      --expression-attribute-values '{":sid":{"S":"<session_id>"}}' \
      --profile fita11y-dev \
      --region us-east-2
  ```
* Windows PowerShell:
  ```powershell
  aws dynamodb query \
      --table-name FitA11y-dev-SessionEvents \
      --key-condition-expression "session_id = :sid" \
      --expression-attribute-values "{\`":sid\`":{\`"S\`":\`"<session_id>\`"}}" \
      --profile fita11y-dev \
      --region us-east-2
  ```

---

## Troubleshooting Storage Setup

### AWS CLI Not Found / Blocked Execution
If your shell throws `command not found: aws` or PowerShell blocks executing the script, check if the AWS CLI is installed. On Windows, if the command is installed but not on the path, prefix the executable's absolute path:
```powershell
& "C:\Program Files\Amazon\AWSCLIV2\aws.exe" cloudformation describe-stacks ...
```

### AccessDenied during CloudFormation Deploy
Occurs if the active AWS CLI role lacks IAM, S3, or DynamoDB resource management permissions.
* **Resolution**: Ensure your IAM User or Role has permissions to manage S3 buckets and DynamoDB tables. Run `aws sts get-caller-identity --profile fita11y-dev` to inspect active credentials.

### AccessDenied on DynamoDB/S3 Actions in Backend
The backend server console prints `ClientError` or access warnings when updating jobs or writing manifests.
* **Resolution**: Double-check that `AWS_PROFILE` in `backend/.env` is set correctly (e.g. `AWS_PROFILE=fita11y-dev`). Check that your credentials file (`~/.aws/credentials`) contains valid credentials for that profile.

### S3 Object Not Found (404/NoSuchKey)
Retrieving manifest or diagnostics from API endpoints results in `404 Video not found` or `NoSuchKey` error log messages.
* **Resolution**: Verify that the preprocessing job status returned `Completed` and did not fail. Ensure `ARTIFACTS_BUCKET` matches your deployed bucket name.

### DynamoDB Decimal/Float Serialization Exceptions
Python's `boto3` package throws `TypeError: Float types are not supported. Use Decimal instead.` when saving raw dictionary payloads containing floats to DynamoDB attribute maps.
* **Resolution**: FitA11y provides utility serialization helpers (`python_to_dynamodb` and `dynamodb_to_python` inside `backend/app/core/storage/dynamodb/utils.py`). They recursively scan JSON-like dictionary trees to automatically convert python `float` objects to DynamoDB-supported `Decimal` objects on save, and back to standard `float` or `int` objects on load. Wrap any custom/manual SDK queries in these helpers.

---

## Safe Dev Data Reset Guide

> [!WARNING]
> Do NOT delete or drop S3 buckets or DynamoDB tables directly. This will break the CloudFormation stack orchestration. To reset data safely during development, empty the tables and recursive prefixes:

### 1. Safely Reset DynamoDB Tables
Run these commands to remove all records in the developer tables without deleting the tables themselves.

**A. Empty Users (`FitA11y-dev-Users`):**
* Standard Bash:
  ```bash
  for id in $(aws dynamodb scan --table-name FitA11y-dev-Users --query "Items[].user_id.S" --output text --profile fita11y-dev --region us-east-2); do
      aws dynamodb delete-item --table-name FitA11y-dev-Users --key "{\"user_id\":{\"S\":\"$id\"}}" --profile fita11y-dev --region us-east-2
  done
  ```
* Windows PowerShell:
  ```powershell
  (aws dynamodb scan --table-name FitA11y-dev-Users --query "Items[].user_id.S" --output text --profile fita11y-dev --region us-east-2) -split "`t" | ForEach-Object {
      if ($_) {
          aws dynamodb delete-item --table-name FitA11y-dev-Users --key "{\`"user_id\`":{\`"S\`":\`"$_`\"}}" --profile fita11y-dev --region us-east-2
      }
  }
  ```

**B. Empty Jobs (`FitA11y-dev-Jobs`):**
* Standard Bash:
  ```bash
  for id in $(aws dynamodb scan --table-name FitA11y-dev-Jobs --query "Items[].video_id.S" --output text --profile fita11y-dev --region us-east-2); do
      aws dynamodb delete-item --table-name FitA11y-dev-Jobs --key "{\"video_id\":{\"S\":\"$id\"}}" --profile fita11y-dev --region us-east-2
  done
  ```
* Windows PowerShell:
  ```powershell
  (aws dynamodb scan --table-name FitA11y-dev-Jobs --query "Items[].video_id.S" --output text --profile fita11y-dev --region us-east-2) -split "`t" | ForEach-Object {
      if ($_) {
          aws dynamodb delete-item --table-name FitA11y-dev-Jobs --key "{\`"video_id\`":{\`"S\`":\`"$_`\"}}" --profile fita11y-dev --region us-east-2
      }
  }
  ```

**C. Empty Sessions (`FitA11y-dev-Sessions`):**
* Standard Bash:
  ```bash
  for id in $(aws dynamodb scan --table-name FitA11y-dev-Sessions --query "Items[].session_id.S" --output text --profile fita11y-dev --region us-east-2); do
      aws dynamodb delete-item --table-name FitA11y-dev-Sessions --key "{\"session_id\":{\"S\":\"$id\"}}" --profile fita11y-dev --region us-east-2
  done
  ```
* Windows PowerShell:
  ```powershell
  (aws dynamodb scan --table-name FitA11y-dev-Sessions --query "Items[].session_id.S" --output text --profile fita11y-dev --region us-east-2) -split "`t" | ForEach-Object {
      if ($_) {
          aws dynamodb delete-item --table-name FitA11y-dev-Sessions --key "{\`"session_id\`":{\`"S\`":\`"$_`\"}}" --profile fita11y-dev --region us-east-2
      }
  }
  ```

**D. Empty Session Events (`FitA11y-dev-SessionEvents` - Composite Key):**
* Standard Bash:
  ```bash
  aws dynamodb scan --table-name FitA11y-dev-SessionEvents --query "Items[].[session_id.S, event_key.S]" --output text --profile fita11y-dev --region us-east-2 | while read -r sid ekey; do
      aws dynamodb delete-item --table-name FitA11y-dev-SessionEvents --key "{\"session_id\":{\"S\":\"$sid\"},\"event_key\":{\"S\":\"$ekey\"}}" --profile fita11y-dev --region us-east-2
  done
  ```
* Windows PowerShell:
  ```powershell
  aws dynamodb scan --table-name FitA11y-dev-SessionEvents --query "Items[].[session_id.S, event_key.S]" --output text --profile fita11y-dev --region us-east-2 | ForEach-Object {
      if ($_) {
          $parts = $_ -split "`t"
          if ($parts.Count -eq 2) {
              $sid = $parts[0]
              $ekey = $parts[1]
              aws dynamodb delete-item --table-name FitA11y-dev-SessionEvents --key "{\`"session_id\`":{\`"S\`":\`"$sid\`"}, \`"event_key\`":{\`"S\`":\`"$ekey\`"}}" --profile fita11y-dev --region us-east-2
          }
      }
  }
  ```

### 2. Safely Remove S3 Generated Artifacts
Run these commands to clean up the stored manifest files, cue plans, and diagnostic logs from S3 without removing the bucket:
```bash
# Clear prepared manifests
aws s3 rm s3://fita11y-dev-artifacts-905418181041/manifests/ --recursive --profile fita11y-dev --region us-east-2

# Clear generated cue plans
aws s3 rm s3://fita11y-dev-artifacts-905418181041/cue-plans/ --recursive --profile fita11y-dev --region us-east-2

# Clear developer diagnostics logs
aws s3 rm s3://fita11y-dev-artifacts-905418181041/diagnostics/ --recursive --profile fita11y-dev --region us-east-2
```





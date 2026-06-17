import uuid
from typing import Optional, List

from app.core.config import settings
from app.core.storage import aws_client
from app.core.storage.interfaces import JobStorage
from app.models.schemas import ProcessingStage
from app.core.job_store import JobRecord, is_legitimate_job, normalize_youtube_url, UNSET
from app.core.storage.dynamodb.utils import python_to_dynamodb, dynamodb_to_python
from boto3.dynamodb.conditions import Key


class DynamoDBJobStorage(JobStorage):
    """DynamoDB implementation for Preprocessing Job tracking."""

    def __init__(self) -> None:
        self._dynamodb = None

    @property
    def table(self):
        if self._dynamodb is None:
            self._dynamodb = aws_client.get_dynamodb_resource()
        return self._dynamodb.Table(settings.DYNAMODB_JOBS_TABLE)

    def create_job(self, youtube_url: str) -> JobRecord:
        video_id = str(uuid.uuid4())
        job = JobRecord(video_id=video_id, youtube_url=youtube_url)
        item = job.to_dict()
        item["library_partition"] = "JOBS"
        item = python_to_dynamodb(item)
        self.table.put_item(Item=item)
        return job

    def get_job(self, video_id: str) -> Optional[JobRecord]:
        response = self.table.get_item(Key={"video_id": str(video_id)})
        item = response.get("Item")
        if item is None:
            return None

        item = dynamodb_to_python(item)
        item.pop("library_partition", None)
        stage_str = item.pop("stage", None)
        stage = ProcessingStage(stage_str) if stage_str else ProcessingStage.SUBMITTED
        return JobRecord(
            stage=stage,
            **item
        )

    def update_stage(self, video_id: str, stage: ProcessingStage, **kwargs) -> None:
        job = self.get_job(video_id)
        if job is None:
            return
        job.stage = stage
        for k, v in kwargs.items():
            if v is not UNSET:
                setattr(job, k, v)
        item = job.to_dict()
        item["library_partition"] = "JOBS"
        item = python_to_dynamodb(item)
        self.table.put_item(Item=item)

    def delete_job(self, video_id: str) -> bool:
        existing = self.get_job(video_id)
        if not existing:
            return False
        self.table.delete_item(Key={"video_id": str(video_id)})
        return True

    def list_jobs(self) -> List[JobRecord]:
        response = self.table.query(
            IndexName="LibraryPartitionCreatedAtIndex",
            KeyConditionExpression=Key("library_partition").eq("JOBS"),
            ScanIndexForward=False
        )
        items = response.get("Items", [])

        jobs = []
        for item in items:
            item = dynamodb_to_python(item)
            item.pop("library_partition", None)
            stage_str = item.pop("stage", None)
            stage = ProcessingStage(stage_str) if stage_str else ProcessingStage.SUBMITTED
            job = JobRecord(
                stage=stage,
                **item
            )
            if is_legitimate_job(job):
                jobs.append(job)
            else:
                self.table.delete_item(Key={"video_id": job.video_id})

        groups = {}
        for job in jobs:
            key = job.youtube_id.strip() if (job.youtube_id and job.youtube_id.strip()) else normalize_youtube_url(job.youtube_url)
            groups.setdefault(key, []).append(job)

        final_jobs = []
        for key, group in groups.items():
            if len(group) == 1:
                final_jobs.append(group[0])
                continue

            def get_priority(j: JobRecord) -> int:
                if j.stage == ProcessingStage.COMPLETED:
                    return 3
                elif j.stage != ProcessingStage.FAILED:
                    return 2
                else:
                    return 1

            group.sort(key=lambda j: (get_priority(j), j.created_at), reverse=True)
            best_job = group[0]
            final_jobs.append(best_job)

            for j in group[1:]:
                self.table.delete_item(Key={"video_id": j.video_id})

        return sorted(final_jobs, key=lambda j: j.created_at, reverse=True)

    def deduplicate_jobs(self) -> None:
        self.list_jobs()

import unittest
from unittest.mock import patch, MagicMock

from app.core.config import settings
from app.core.storage import (
    get_user_storage,
    get_job_storage,
    get_session_storage,
    get_artifact_storage,
)
from app.core.storage.dynamodb import (
    DynamoDBUserStorage,
    DynamoDBJobStorage,
    DynamoDBSessionStorage,
)
from app.core.user_store import UserStore
from app.core.job_store import JobStore
from app.core.session_store import SessionStore
from app.core.storage.local_json import LocalJsonGeneratedArtifactStorage


class TestStorageFactory(unittest.TestCase):

    def setUp(self) -> None:
        self.original_provider = settings.STORAGE_PROVIDER
        # Clear factory global singletons for testing
        from app.core.storage import factory
        factory._user_storage = None
        factory._job_storage = None
        factory._session_storage = None
        factory._artifact_storage = None

    def tearDown(self) -> None:
        settings.STORAGE_PROVIDER = self.original_provider
        from app.core.storage import factory
        factory._user_storage = None
        factory._job_storage = None
        factory._session_storage = None
        factory._artifact_storage = None

    def test_default_storage_provider_is_local_json(self) -> None:
        # Check factory returns local JSON implementations when STORAGE_PROVIDER = local_json
        settings.STORAGE_PROVIDER = "local_json"
        
        self.assertIsInstance(get_user_storage(), UserStore)
        self.assertIsInstance(get_job_storage(), JobStore)
        self.assertIsInstance(get_session_storage(), SessionStore)
        self.assertIsInstance(get_artifact_storage(), LocalJsonGeneratedArtifactStorage)

    def test_unknown_storage_provider_raises_value_error(self) -> None:
        settings.STORAGE_PROVIDER = "unknown_db"
        with self.assertRaises(ValueError):
            get_user_storage()
        with self.assertRaises(ValueError):
            get_job_storage()

    @patch("app.core.storage.aws_client.get_s3_client")
    @patch("app.core.storage.aws_client.get_dynamodb_resource")
    def test_dynamodb_provider_instantiation(self, mock_get_dynamodb, mock_get_s3) -> None:
        settings.STORAGE_PROVIDER = "dynamodb"
        
        from app.core.storage.s3_artifacts import S3GeneratedArtifactStorage
        self.assertIsInstance(get_user_storage(), DynamoDBUserStorage)
        self.assertIsInstance(get_job_storage(), DynamoDBJobStorage)
        self.assertIsInstance(get_session_storage(), DynamoDBSessionStorage)
        self.assertIsInstance(get_artifact_storage(), S3GeneratedArtifactStorage)

    @patch("app.core.storage.local_json.load_manifest_from_disk")
    @patch("app.core.storage.local_json.save_manifest_to_disk")
    @patch("app.core.storage.local_json.delete_manifest_from_disk")
    def test_artifact_local_json_delegation(
        self, mock_delete, mock_save, mock_load
    ) -> None:
        settings.STORAGE_PROVIDER = "local_json"
        storage = get_artifact_storage()
        
        mock_load.return_value = "mock_manifest"
        res = storage.load_manifest("video-1")
        mock_load.assert_called_once_with("video-1")
        self.assertEqual(res, "mock_manifest")

        storage.save_manifest("video-1", "mock_manifest")
        mock_save.assert_called_once_with("video-1", "mock_manifest")

        mock_delete.return_value = True
        del_res = storage.delete_manifest("video-1")
        mock_delete.assert_called_once_with("video-1")
        self.assertTrue(del_res)

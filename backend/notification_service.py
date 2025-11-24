"""
Notification service for the Translation API Server.

Uses plyer when available; falls back to console output otherwise.
"""

import logging

logger = logging.getLogger(__name__)

# Try to import plyer for notifications, fallback to console if not available
try:
    from plyer import notification
except ImportError:
    notification = None


class NotificationService:
    """Abstracts notification functionality for cross-platform compatibility."""

    @staticmethod
    def send_translation_complete() -> None:
        """Send notification when translation is completed."""
        if notification is None:
            print("🎉 번역이 성공적으로 완료되었습니다.")
            logger.info("plyer 미설치로 터미널 알림 사용")
            return

        assert notification is not None  # for type checkers
        try:
            notification.notify(  # type: ignore[reportOptionalCall]
                title="Youtube Translator",
                message="요청하신 번역이 성공적으로 완료되었습니다.",
                timeout=5,
                app_name="My Translator",
            )
        except Exception as e:  # pragma: no cover - notification failure path
            print("🎉 번역이 성공적으로 완료되었습니다.")
            logger.warning(f"알림 전송 실패 (무시됨): {e}")

    @staticmethod
    def send_custom_notification(title: str, message: str, timeout: int = 5) -> None:
        """Send a custom notification with specified parameters."""
        if notification is None:
            print(f"🎉 {message}")
            logger.info("plyer 미설치로 터미널 알림 사용")
            return

        assert notification is not None  # for type checkers
        try:
            notification.notify(  # type: ignore[reportOptionalCall]
                title=title,
                message=message,
                timeout=timeout,
                app_name="My Translator",
            )
        except Exception as e:  # pragma: no cover
            print(f"🎉 {message}")
            logger.warning(f"알림 전송 실패 (무시됨): {e}")

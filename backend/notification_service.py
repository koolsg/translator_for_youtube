"""
Notification service for the Translation API Server.

This module provides an abstraction layer for sending notifications
to users when translation is completed, supporting both system notifications
and console output as fallback.
"""

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    try:
        from plyer import notification as plyer_notification
    except ImportError:
        plyer_notification = None

logger = logging.getLogger(__name__)

# Try to import plyer for notifications, fallback to console if not available
try:
    from plyer import notification
    has_plyer = True
except ImportError:
    notification = None
    has_plyer = False


class NotificationService:
    """Abstracts notification functionality for cross-platform compatibility."""

    @staticmethod
    def send_translation_complete() -> None:
        """
        Send notification when translation is completed.

        Attempts to send a system notification using plyer, with console output as fallback.
        This method gracefully handles missing dependencies and platform limitations.
        """
        if has_plyer:
            # Use plyer for cross-platform system notifications
            try:
                notification.notify(
                    title="Youtube Translator",
                    message="요청하신 번역이 성공적으로 완료되었습니다.",
                    timeout=5,  # Display time in seconds
                    app_name="My Translator"  # App name used on Linux
                )
            except Exception as e:
                # Notification failed for any other reason, log warning but continue
                print("🔔 번역이 성공적으로 완료되었습니다.")
                logger.warning(f"알림 전송 실패 (무시됨): {e}")
        else:
            # plyer is not installed, use console output as fallback
            print("🔔 번역이 성공적으로 완료되었습니다.")
            logger.info("plyer 미설치로 터미널 알림 사용")

    @staticmethod
    def send_custom_notification(title: str, message: str, timeout: int = 5) -> None:
        """
        Send a custom notification with specified parameters.

        Args:
            title: Notification title
            message: Notification message
            timeout: Display timeout in seconds
        """
        if has_plyer:
            try:
                notification.notify(
                    title=title,
                    message=message,
                    timeout=timeout,
                    app_name="My Translator"
                )
            except Exception as e:
                print(f"🔔 {message}")
                logger.warning(f"알림 전송 실패 (무시됨): {e}")
        else:
            print(f"🔔 {message}")
            logger.info("plyer 미설치로 터미널 알림 사용")

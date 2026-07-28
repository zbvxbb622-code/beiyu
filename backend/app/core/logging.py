import json
import logging
from typing import Any

REQUEST_LOGGER_NAME = "beiyu.request"


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "event": record.getMessage(),
            "level": record.levelname,
        }
        payload.update(getattr(record, "structured", {}))
        return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def configure_request_logging() -> logging.Logger:
    logger = logging.getLogger(REQUEST_LOGGER_NAME)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        logger.propagate = False
    return logger

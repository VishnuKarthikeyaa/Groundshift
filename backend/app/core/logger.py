"""
GROUNDSHIFT Centralized Logging Configuration.
Provides standard formatted console and optional file logging with structured metadata.
"""

import logging
import sys
from backend.app.config import settings

def setup_logger(name: str = "groundshift") -> logging.Logger:
    logger = logging.getLogger(name)
    
    # Avoid duplicate handlers if already initialized
    if logger.handlers:
        return logger

    level = getattr(logging, settings.LOG_LEVEL, logging.INFO)
    logger.setLevel(level)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(level)
    logger.addHandler(console_handler)

    logger.propagate = False
    return logger

logger = setup_logger()


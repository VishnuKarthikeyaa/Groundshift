"""
GROUNDSHIFT Memory Governor.
Safeguards Windows 11 host resources (16 GB profile) by monitoring physical RAM
and process resident set size (RSS).
"""

import os
import psutil
from typing import Dict, Any
from backend.app.config import settings
from backend.app.core.logger import logger

class MemoryGovernor:
    @staticmethod
    def get_system_memory() -> Dict[str, Any]:
        """Returns physical and virtual memory metrics in Megabytes."""
        vm = psutil.virtual_memory()
        process = psutil.Process(os.getpid())
        process_mem = process.memory_info()

        return {
            "total_physical_mb": round(vm.total / (1024 * 1024), 2),
            "available_physical_mb": round(vm.available / (1024 * 1024), 2),
            "used_physical_mb": round(vm.used / (1024 * 1024), 2),
            "physical_percent_used": vm.percent,
            "process_rss_mb": round(process_mem.rss / (1024 * 1024), 2),
            "process_vms_mb": round(process_mem.vms / (1024 * 1024), 2),
            "max_threshold_mb": settings.MAX_MEMORY_THRESHOLD_MB,
            "min_free_threshold_mb": settings.MIN_FREE_MEMORY_MB,
            "is_memory_safe": (vm.available / (1024 * 1024)) >= settings.MIN_FREE_MEMORY_MB,
        }

    @staticmethod
    def check_memory_headroom() -> bool:
        """
        Validates whether sufficient memory exists to launch a heavy SAR computation.
        Returns True if safe, False if under memory pressure.
        """
        stats = MemoryGovernor.get_system_memory()
        if not stats["is_memory_safe"]:
            logger.warning(
                f"Memory pressure detected! Available: {stats['available_physical_mb']} MB, "
                f"Required: {stats['min_free_threshold_mb']} MB."
            )
            return False
        return True


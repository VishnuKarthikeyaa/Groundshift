"""
GROUNDSHIFT Temporal Alignment & Baseline Compatibility Module.
Evaluates temporal baselines, epoch pairing, and time-series span overlap.

Scientific Rule:
- Never assume observations from different dates represent identical ground conditions.
- Flags temporal separation > 12 days for paired comparisons as subject to unmodeled dynamic deformation.
"""

import datetime
from typing import Dict, Any, List, Optional, Tuple
import numpy as np


class TemporalAlignmentResult:
    """Encapsulates temporal pairing, temporal baselines, and overlap metrics."""
    def __init__(
        self,
        is_temporally_compatible: bool,
        temporal_separation_days: float,
        shared_time_span_days: float,
        start_date_1: str,
        end_date_1: str,
        start_date_2: str,
        end_date_2: str,
        matched_epoch_count: int,
        temporal_warning: Optional[str] = None
    ):
        self.is_temporally_compatible = is_temporally_compatible
        self.temporal_separation_days = round(temporal_separation_days, 1)
        self.shared_time_span_days = round(shared_time_span_days, 1)
        self.start_date_1 = start_date_1
        self.end_date_1 = end_date_1
        self.start_date_2 = start_date_2
        self.end_date_2 = end_date_2
        self.matched_epoch_count = matched_epoch_count
        self.temporal_warning = temporal_warning

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_temporally_compatible": self.is_temporally_compatible,
            "temporal_separation_days": self.temporal_separation_days,
            "shared_time_span_days": self.shared_time_span_days,
            "dataset_1_span": {"start": self.start_date_1, "end": self.end_date_1},
            "dataset_2_span": {"start": self.start_date_2, "end": self.end_date_2},
            "matched_epoch_count": self.matched_epoch_count,
            "temporal_warning": self.temporal_warning,
        }


def parse_iso_date(dt_str: str) -> datetime.datetime:
    """Parses various ISO date formats into a datetime object."""
    clean = dt_str.replace("Z", "").split("T")[0]
    return datetime.datetime.strptime(clean, "%Y-%m-%d")


def evaluate_temporal_alignment(
    epochs_1: List[str],
    epochs_2: List[str],
    max_pairwise_separation_days: float = 12.0
) -> TemporalAlignmentResult:
    """
    Evaluates temporal alignment between two SAR acquisition series or single epochs.
    Calculates pairwise temporal separation and total overlapping observation window.
    """
    if not epochs_1 or not epochs_2:
        return TemporalAlignmentResult(
            is_temporally_compatible=False,
            temporal_separation_days=9999.0,
            shared_time_span_days=0.0,
            start_date_1="", end_date_1="",
            start_date_2="", end_date_2="",
            matched_epoch_count=0,
            temporal_warning="One or both datasets have empty acquisition date records."
        )

    dts_1 = sorted([parse_iso_date(d) for d in epochs_1])
    dts_2 = sorted([parse_iso_date(d) for d in epochs_2])

    start_1, end_1 = dts_1[0], dts_1[-1]
    start_2, end_2 = dts_2[0], dts_2[-1]

    # Shared overlapping time span
    overlap_start = max(start_1, start_2)
    overlap_end = min(end_1, end_2)
    shared_days = max(0.0, (overlap_end - overlap_start).total_seconds() / 86400.0)

    # For single-epoch comparison (e.g. interferogram pairs)
    if len(dts_1) == 1 and len(dts_2) == 1:
        sep_days = abs((dts_1[0] - dts_2[0]).total_seconds() / 86400.0)
        is_compat = sep_days <= max_pairwise_separation_days
        warning = None
        if not is_compat:
            warning = (
                f"INSUFFICIENT TEMPORAL PROXIMITY: Acquisitions differ by {sep_days:.1f} days "
                f"(threshold is {max_pairwise_separation_days:.1f} days). Non-simultaneous observations cannot be assumed to represent identical surface displacement."
            )
        return TemporalAlignmentResult(
            is_temporally_compatible=is_compat,
            temporal_separation_days=sep_days,
            shared_time_span_days=shared_days,
            start_date_1=start_1.strftime("%Y-%m-%d"),
            end_date_1=end_1.strftime("%Y-%m-%d"),
            start_date_2=start_2.strftime("%Y-%m-%d"),
            end_date_2=end_2.strftime("%Y-%m-%d"),
            matched_epoch_count=1 if is_compat else 0,
            temporal_warning=warning
        )

    # For multi-temporal series (e.g. velocity / time-series products)
    # Find matching pairs within tolerance
    matched_count = 0
    total_sep = 0.0
    for dt1 in dts_1:
        diffs = [abs((dt1 - dt2).total_seconds() / 86400.0) for dt2 in dts_2]
        min_diff = min(diffs)
        if min_diff <= max_pairwise_separation_days:
            matched_count += 1
            total_sep += min_diff

    mean_sep = (total_sep / matched_count) if matched_count > 0 else 999.0
    is_compat = (shared_days > 60.0) or (matched_count >= 3)
    warning = None
    if not is_compat:
        warning = (
            f"POOR TEMPORAL OVERLAP: Only {matched_count} epoch pairs align within {max_pairwise_separation_days:.1f} days. "
            f"Overlapping duration is {shared_days:.1f} days. Velocity comparisons require extended co-temporal coverage."
        )

    return TemporalAlignmentResult(
        is_temporally_compatible=is_compat,
        temporal_separation_days=mean_sep,
        shared_time_span_days=shared_days,
        start_date_1=start_1.strftime("%Y-%m-%d"),
        end_date_1=end_1.strftime("%Y-%m-%d"),
        start_date_2=start_2.strftime("%Y-%m-%d"),
        end_date_2=end_2.strftime("%Y-%m-%d"),
        matched_epoch_count=matched_count,
        temporal_warning=warning
    )


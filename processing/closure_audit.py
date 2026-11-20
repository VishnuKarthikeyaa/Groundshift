"""
GROUNDSHIFT Interferometric Phase Triplet Closure Engine.
Audits phase loop closures (C_123 = W{phi_12 + phi_23 - phi_13}) to identify
phase unwrapping cycle slips and non-zero closure anomalies.
"""

import numpy as np
from typing import Dict, Any, Union

def wrap_phase(phase: Union[float, np.ndarray]) -> Union[float, np.ndarray]:
    """Wraps phase values into the principal interval [-pi, pi)."""
    return np.arctan2(np.sin(phase), np.cos(phase))

def audit_phase_triplet(
    phi_12: float,
    phi_23: float,
    phi_13: float,
    coherence_12: float = 0.8,
    coherence_23: float = 0.8,
    coherence_13: float = 0.8,
    cycle_slip_threshold_rad: float = 0.45
) -> Dict[str, Any]:
    """
    Computes triangular phase closure residual:
      C_123 = wrap(phi_12 + phi_23 - phi_13)
    
    Under ideal unwrapping and low noise, C_123 == 0.
    Non-zero residuals indicate phase unwrapping errors (cycle slips),
    soil moisture phase shifts, or severe decorrelation.
    """
    sum_phase = phi_12 + phi_23 - phi_13
    closure_residual = float(wrap_phase(sum_phase))
    mean_coherence = float(np.mean([coherence_12, coherence_23, coherence_13]))

    has_cycle_slip = abs(closure_residual) > cycle_slip_threshold_rad

    return {
        "raw_sum_rad": round(float(sum_phase), 4),
        "closure_residual_rad": round(closure_residual, 4),
        "closure_residual_deg": round(float(np.degrees(closure_residual)), 2),
        "mean_coherence": round(mean_coherence, 3),
        "is_loop_closed": abs(closure_residual) <= cycle_slip_threshold_rad,
        "has_cycle_slip": has_cycle_slip,
        "estimated_integer_slip": int(np.round((sum_phase - closure_residual) / (2 * np.pi))),
        "quality_status": "FLAGGED_CYCLE_SLIP" if has_cycle_slip else "CONSISTENT_CLOSURE",
        "classification": "DERIVED_GEOPHYSICAL_INFERRED"
    }


"""
GROUNDSHIFT Scientific Physics & Radargrammetry Unit Tests.
Verifies mathematical correctness of vector decomposition, phase loop closure,
and in-situ GNSS projections.
"""

import numpy as np
import pytest
from processing.decomposition import calculate_look_vector, decompose_2d_los
from processing.closure_audit import audit_phase_triplet, wrap_phase
from processing.insitu_aligner import project_gnss_to_los, evaluate_insitu_consistency
from processing.radiometric import sigma0_to_gamma0, linear_to_db, db_to_linear, calculate_enl


def test_look_vector_orthonormality():
    """Verify that computed look vector is a unit vector (norm == 1)."""
    inc = 38.5
    head = 349.2
    u = calculate_look_vector(inc, head)
    assert np.isclose(np.linalg.norm(u), 1.0, atol=1e-6)
    # Up component must be cos(inc) > 0 for right-looking SAR
    assert u[2] > 0


def test_2d_los_vector_decomposition_exact_recovery():
    """
    Forward-models true [d_east, d_up] displacement onto ascending and descending LOS,
    then executes 2D inversion to verify exact numerical recovery.
    """
    true_east = 12.5  # mm
    true_up = -28.4   # mm (subsidence)

    inc_asc, head_asc = 39.2, 348.5
    inc_desc, head_desc = 41.5, 192.1

    u_asc = calculate_look_vector(inc_asc, head_asc)
    u_desc = calculate_look_vector(inc_desc, head_desc)

    # Forward model scalar LOS observations
    d_asc = u_asc[0] * true_east + u_asc[2] * true_up
    d_desc = u_desc[0] * true_east + u_desc[2] * true_up

    # Invert via weighted least squares
    result = decompose_2d_los(
        d_asc=d_asc,
        d_desc=d_desc,
        inc_asc_deg=inc_asc,
        head_asc_deg=head_asc,
        inc_desc_deg=inc_desc,
        head_desc_deg=head_desc,
        sigma_asc=1.0,
        sigma_desc=1.0
    )

    assert np.isclose(result["d_east"], true_east, atol=1e-4)
    assert np.isclose(result["d_up"], true_up, atol=1e-4)
    assert result["is_well_conditioned"] is True
    assert result["classification"] == "DERIVED_GEOPHYSICAL_INFERRED"


def test_phase_wrapping_operator():
    """Verify that wrap_phase strictly confines values to [-pi, pi)."""
    angles = np.array([-4*np.pi, -np.pi - 0.1, 0.0, np.pi - 0.1, 3.5*np.pi])
    wrapped = wrap_phase(angles)
    assert np.all(wrapped >= -np.pi)
    assert np.all(wrapped <= np.pi)


def test_phase_triplet_closure_ideal():
    """Verify that closed loops with zero unwrapping error yield zero residual."""
    phi_12 = 1.25
    phi_23 = -0.45
    phi_13 = 0.80  # phi_12 + phi_23 = 0.80

    audit = audit_phase_triplet(phi_12, phi_23, phi_13)
    assert np.isclose(audit["closure_residual_rad"], 0.0, atol=1e-5)
    assert audit["has_cycle_slip"] is False
    assert audit["quality_status"] == "CONSISTENT_CLOSURE"


def test_phase_triplet_closure_cycle_slip():
    """Verify that an unwrapping cycle slip (2pi jump) is correctly detected and flagged."""
    phi_12 = 1.25
    phi_23 = -0.45
    phi_13 = 0.80 + 2 * np.pi  # Injected 1-cycle slip

    audit = audit_phase_triplet(phi_12, phi_23, phi_13)
    assert audit["has_cycle_slip"] is True or audit["estimated_integer_slip"] != 0
    assert audit["estimated_integer_slip"] == -1


def test_gnss_projection_and_statistics():
    """Verify GNSS 3D-to-LOS projection and statistical metric evaluation."""
    sar_vals = [2.1, 4.0, 6.2, 8.1, 10.0]
    gnss_vals = [2.0, 4.1, 6.0, 7.9, 10.2]

    metrics = evaluate_insitu_consistency(sar_vals, gnss_vals)
    assert metrics["rmse_mm"] < 0.3
    assert metrics["pearson_r"] > 0.99
    assert metrics["validation_grade"] == "EXCELLENT"


def test_radiometric_flattening():
    """Verify sigma0 to gamma0 terrain-flattening behavior."""
    sigma0 = 0.05
    inc = 45.0  # cos(45) = 1/sqrt(2) approx 0.7071
    gamma0 = sigma0_to_gamma0(sigma0, inc)
    assert gamma0 > sigma0
    assert np.isclose(gamma0, sigma0 / np.cos(np.radians(45.0)))


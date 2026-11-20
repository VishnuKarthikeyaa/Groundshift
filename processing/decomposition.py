"""
GROUNDSHIFT InSAR Line-of-Sight (LOS) 2D Vector Decomposition Engine.
Resolves multi-track scalar radar measurements into true horizontal (East-West)
and vertical (Up-Down) displacement vectors using weighted least squares inversion.
"""

import numpy as np
from typing import Dict, Any, Union

def calculate_look_vector(incidence_deg: float, azimuth_heading_deg: float) -> np.ndarray:
    """
    Computes unit Line-of-Sight directional components [e, n, u]
    from local incidence angle (theta) and flight heading angle (alpha_h).
    """
    theta = np.radians(incidence_deg)
    alpha = np.radians(azimuth_heading_deg)

    e = -np.sin(theta) * np.cos(alpha)
    n = np.sin(theta) * np.sin(alpha)
    u = np.cos(theta)
    return np.array([e, n, u])


def decompose_2d_los(
    d_asc: Union[float, np.ndarray],
    d_desc: Union[float, np.ndarray],
    inc_asc_deg: float,
    head_asc_deg: float,
    inc_desc_deg: float,
    head_desc_deg: float,
    sigma_asc: float = 1.0,
    sigma_desc: float = 1.0,
    max_condition_number: float = 12.0
) -> Dict[str, Any]:
    """
    Inverts paired Ascending and Descending LOS observations into [d_east, d_up].
    
    Geometry Matrix G:
      G = [[e_asc,  u_asc ],
           [e_desc, u_desc]]
    
    Weighted Normal Equations:
      d_hat = (G^T * W * G)^(-1) * G^T * W * d_los
    """
    # 1. Compute look vectors
    u_asc = calculate_look_vector(inc_asc_deg, head_asc_deg)
    u_desc = calculate_look_vector(inc_desc_deg, head_desc_deg)

    # 2. Construct 2x2 Geometry Matrix G for [East, Up]
    G = np.array([
        [u_asc[0], u_asc[2]],
        [u_desc[0], u_desc[2]]
    ])

    # 3. Check Condition Number and Invertibility
    cond_number = float(np.linalg.cond(G))
    is_well_conditioned = cond_number < max_condition_number

    # 4. Construct Weight Matrix W from observation uncertainties
    w_asc = 1.0 / max(sigma_asc**2, 1e-6)
    w_desc = 1.0 / max(sigma_desc**2, 1e-6)
    W = np.diag([w_asc, w_desc])

    # 5. Normal Equations Inversion
    GtW = G.T @ W
    GtWG = GtW @ G
    cov_d = np.linalg.inv(GtWG)

    d_obs = np.array([d_asc, d_desc])
    d_hat = cov_d @ (GtW @ d_obs)

    sigma_east = float(np.sqrt(cov_d[0, 0]))
    sigma_up = float(np.sqrt(cov_d[1, 1]))

    return {
        "d_east": float(d_hat[0]),
        "d_up": float(d_hat[1]),
        "sigma_east": sigma_east,
        "sigma_up": sigma_up,
        "condition_number": round(cond_number, 3),
        "is_well_conditioned": is_well_conditioned,
        "geometry_coefficients": {
            "asc_e": round(float(G[0, 0]), 4),
            "asc_u": round(float(G[0, 1]), 4),
            "desc_e": round(float(G[1, 0]), 4),
            "desc_u": round(float(G[1, 1]), 4),
        },
        "classification": "DERIVED_GEOPHYSICAL_INFERRED"
    }


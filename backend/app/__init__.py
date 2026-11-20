"""
GROUNDSHIFT Application Package.
Configures Windows 11 Conda DLL paths and environment variables upon import.
"""

import os
import sys
from pathlib import Path

# Windows Conda dynamic DLL and data path registration
if sys.platform == "win32":
    env_dir = Path(sys.executable).parent
    library_bin = env_dir / "Library" / "bin"
    library_share_gdal = env_dir / "Library" / "share" / "gdal"
    library_share_proj = env_dir / "Library" / "share" / "proj"

    if library_bin.exists():
        try:
            os.add_dll_directory(str(library_bin))
        except (AttributeError, OSError):
            pass
        os.environ["PATH"] = str(library_bin) + os.pathsep + os.environ.get("PATH", "")

    if library_share_gdal.exists() and "GDAL_DATA" not in os.environ:
        os.environ["GDAL_DATA"] = str(library_share_gdal)

    if library_share_proj.exists() and "PROJ_LIB" not in os.environ:
        os.environ["PROJ_LIB"] = str(library_share_proj)

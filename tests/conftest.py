"""
Pytest configuration for GROUNDSHIFT.
Ensures Windows Conda DLL paths are loaded before test execution.
"""

import os
import sys
from pathlib import Path

# Register DLL directory for Conda on Windows
if sys.platform == "win32":
    env_dir = Path(sys.executable).parent
    library_bin = env_dir / "Library" / "bin"
    if library_bin.exists():
        try:
            os.add_dll_directory(str(library_bin))
        except (AttributeError, OSError):
            pass
        os.environ["PATH"] = str(library_bin) + os.pathsep + os.environ.get("PATH", "")


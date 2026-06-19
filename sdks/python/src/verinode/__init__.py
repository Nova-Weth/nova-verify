"""
Nova Verify Python SDK

Official Python SDK for Nova Verify - Web3 infrastructure for cryptographic proofs.
"""

from .client import Nova Verify
from .config import NovaVerifyConfig
from .exceptions import NovaVerifyError, NovaVerifyAPIError, NovaVerifyAuthError
from .types import Proof, Verification, Wallet, User
from .services import ProofService, VerificationService, WalletService

__version__ = "1.0.0"
__author__ = "Nova Verify Team"
__email__ = "team@nova-verify.com"

__all__ = [
    "Nova Verify",
    "NovaVerifyConfig",
    "NovaVerifyError",
    "NovaVerifyAPIError",
    "NovaVerifyAuthError",
    "Proof",
    "Verification",
    "Wallet",
    "User",
    "ProofService",
    "VerificationService",
    "WalletService",
]

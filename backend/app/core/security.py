from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets
from typing import Any, Dict, Optional
from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
import bcrypt
import jwt
from app.core.config import settings

# Argon2id configuration per RFC 9106 and system specifications:
# Memory cost: m=65536 (64 MiB)
# Time cost: t=3 (iterations)
# Parallelism: p=4 (threads/lanes)
# Target hash prefix: $argon2id$v=19$m=65536,
_argon2_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
    type=Type.ID,
)


def get_password_hash(password: str) -> str:
    """
    Generate Argon2id password hash ($argon2id$v=19$m=65536,...).
    """
    return _argon2_hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify plain password against stored hash.
    Supports:
    1. Primary: Argon2id ($argon2id$...)
    2. Backward compatibility: Legacy BCrypt ($2a$, $2b$, $2y$)
    """
    if not plain_password or not hashed_password:
        return False
    try:
        # Argon2 verification (Argon2id primary)
        if hashed_password.startswith("$argon2"):
            return _argon2_hasher.verify(hashed_password, plain_password)

        # Legacy BCrypt verification for existing accounts
        if hashed_password.startswith(("$2a$", "$2b$", "$2y$")):
            plain_bytes = plain_password.encode("utf-8")
            hashed_bytes = hashed_password.encode("utf-8")
            return bcrypt.checkpw(plain_bytes, hashed_bytes)

        return False
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False
    except Exception:
        return False


def needs_rehash(hashed_password: str) -> bool:
    """
    Check if a stored password hash requires transparent upgrading to Argon2id.
    Returns True for legacy BCrypt hashes or outdated Argon2 parameters.
    """
    if not hashed_password:
        return True
    if not hashed_password.startswith("$argon2id$v=19$m=65536,"):
        return True
    try:
        return _argon2_hasher.check_needs_rehash(hashed_password)
    except Exception:
        return True



def create_access_token(
    subject: Any,
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Generate JWT access token.
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    if extra_claims:
        to_encode.update(extra_claims)

    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: Any) -> str:
    """Generate JWT refresh token."""
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    """Decode and validate JWT token signature and expiry."""
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        return payload
    except jwt.PyJWTError as e:
        raise ValueError(f"Invalid token: {str(e)}")


def generate_recovery_code() -> str:
    """Generate human-friendly and cryptographically secure recovery code (e.g. REC-A1B2-C3D4)."""
    p1 = secrets.token_hex(2).upper()
    p2 = secrets.token_hex(2).upper()
    return f"REC-{p1}-{p2}"


def normalize_recovery_code(code: str) -> str:
    """Normalize recovery code by stripping spaces, dashes and uppercasing."""
    if not code:
        return ""
    return code.strip().replace("-", "").upper()


def hash_recovery_code(user_id: str, raw_code: str) -> str:
    """Compute deterministic salted SHA-256 hash for recovery code verification."""
    normalized = normalize_recovery_code(raw_code)
    salted = f"{user_id}:{normalized}".encode("utf-8")
    return hashlib.sha256(salted).hexdigest()


def verify_recovery_code_hash(user_id: str, raw_code: str, stored_hash: str) -> bool:
    """Verify raw code against stored hash with constant-time comparison."""
    if not raw_code or not stored_hash:
        return False
    computed = hash_recovery_code(user_id, raw_code)
    return hmac.compare_digest(computed, stored_hash)


def create_recovery_session_token(subject: Any, expires_delta: Optional[timedelta] = None) -> str:
    """
    Generate restricted single-use recovery session JWT token.
    Explicitly has type='recovery' and short lifetime (default 15 minutes).
    Cannot be used for general API access.
    """
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "recovery",
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


from datetime import datetime, timedelta, timezone
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

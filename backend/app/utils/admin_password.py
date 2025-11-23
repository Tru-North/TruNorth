import bcrypt

def hash_admin_password(plain: str):
    salt = bcrypt.gensalt()
    hash_value = bcrypt.hashpw(plain.encode(), salt)
    return hash_value.decode(), salt.decode()

def verify_admin_password(plain: str, stored_hash: str, stored_salt: str):
    new_hash = bcrypt.hashpw(plain.encode(), stored_salt.encode()).decode()
    return new_hash == stored_hash

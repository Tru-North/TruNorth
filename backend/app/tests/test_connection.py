import psycopg2
from psycopg2 import OperationalError
from app.core.config import DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER

try:
    conn = psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT,
    )
    print("✅ Connection successful!")
    cur = conn.cursor()
    cur.execute("SELECT version();")
    print(cur.fetchone())
    conn.close()
except OperationalError as e:
    print("❌ Connection failed:")
    print(e)

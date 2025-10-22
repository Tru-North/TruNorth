import psycopg2
from app.core.config import DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER
from psycopg2 import Error


def get_connection():
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT,
        database=DB_NAME, user=DB_USER, password=DB_PASSWORD
    )

def setup_database():
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users(
                id SERIAL PRIMARY KEY,
                FirstName VARCHAR(255),
                LastName VARCHAR(255),
                Email VARCHAR(255) UNIQUE,
                Password VARCHAR(255),
                firebase_uid VARCHAR(128) UNIQUE
            );
        """)
        conn.commit()
        cur.close()
        conn.close()
    except Error as e:
        print(f"Error creating table: {e}")

"""
Run database migration to create password_reset_tokens table
"""
import asyncio
from sqlalchemy import text
from src.core.database import engine


async def run_migration():
    """Create password_reset_tokens table"""
    
    try:
        async with engine.begin() as conn:
            # Create table
            create_table_sql = """
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                token VARCHAR(255) NOT NULL UNIQUE,
                expires_at TIMESTAMP NOT NULL,
                used BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
            await conn.execute(text(create_table_sql))
            print("✅ Table created")
            
            # Create indexes
            index1_sql = "CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token)"
            await conn.execute(text(index1_sql))
            print("✅ Index on token created")
            
            index2_sql = "CREATE INDEX IF NOT EXISTS idx_password_reset_user_id ON password_reset_tokens(user_id)"
            await conn.execute(text(index2_sql))
            print("✅ Index on user_id created")
        
        print("\n✅ Migration successful! password_reset_tokens table and indexes created.")
        return True
    except Exception as e:
        print(f"\n❌ Migration failed: {str(e)}")
        return False


if __name__ == "__main__":
    print("Running password reset migration...")
    asyncio.run(run_migration())

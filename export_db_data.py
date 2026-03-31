import os
import psycopg2
from psycopg2 import sql
import csv
from dotenv import load_dotenv
from urllib.parse import urlparse
from datetime import datetime

# Load environment variables
load_dotenv()

def get_db_connection():
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("DATABASE_URL not found in .env")
        return None
    
    # Handle both postgresql and postgres schemes
    db_url = db_url.replace('postgresql+psycopg2://', 'postgresql://')
    
    try:
        conn = psycopg2.connect(db_url)
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return None

def export_all_tables():
    conn = get_db_connection()
    if not conn:
        return

    try:
        cur = conn.cursor()
        
        # Get all table names in public schema
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        """)
        
        tables = [row[0] for row in cur.fetchall()]
        
        print(f"Found {len(tables)} tables: {', '.join(tables)}")
        
        # Create output directory if it doesn't exist
        os.makedirs('exports', exist_ok=True)
        
        summary = []
        
        for table in tables:
            print(f"Exporting table: {table}...")
            
            # Fetch table data
            cur.execute(sql.SQL("SELECT * FROM {}").format(sql.Identifier(table)))
            
            # Get column names
            colnames = [desc[0] for desc in cur.description]
            
            rows = cur.fetchall()
            
            output_file = f'exports/{table}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            
            with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
                writer = csv.writer(csvfile)
                # Write header
                writer.writerow(colnames)
                # Write data
                writer.writerows(rows)
            
            print(f"  - Exported {len(rows)} rows to {output_file}")
            summary.append({'table': table, 'rows': len(rows), 'file': output_file})
            
        print("\nExport completed successfully!")
        print("-" * 30)
        for s in summary:
            print(f"{s['table']:25} | {s['rows']:5} rows | {s['file']}")
        print("-" * 30)
        
    except Exception as e:
        print(f"An error occurred during export: {e}")
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    export_all_tables()

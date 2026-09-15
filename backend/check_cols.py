from database import engine
from sqlalchemy import text

conn = engine.connect()
r = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='parcels' ORDER BY ordinal_position"))
print([row[0] for row in r.fetchall()])
conn.close()

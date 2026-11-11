from pathlib import Path
import sqlite3
root=Path.cwd();backup=root/'.local/backup-etapa3-base';backup.mkdir(exist_ok=False)
for name in ['backend/demo.cjs','portal.js','assets/proposal/proposal-demo.js','assets/proposal/index.html','demo.css']:
 p=backup/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((root/name).read_bytes())
db=root/'data/quotes.sqlite'
if db.exists():
 with sqlite3.connect(db.as_uri()+'?mode=ro',uri=True) as src:
  with sqlite3.connect(backup/'quotes.sqlite') as dst:src.backup(dst)
print('Backup de código e SQLite concluído.')

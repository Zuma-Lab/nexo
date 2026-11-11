from pathlib import Path
import difflib
base=Path('.local/backup-etapa3-base');names=['backend/demo.cjs','portal.js','assets/proposal/proposal-demo.js','assets/proposal/index.html','backend/commercial.cjs','backend/commercial.test.cjs','docs/ETAPA3-COMERCIAL.md'];patch=[]
for name in names:
 old=(base/name).read_text(encoding='utf-8').splitlines(keepends=True) if (base/name).exists() else []
 new=Path(name).read_text(encoding='utf-8').splitlines(keepends=True)
 patch.extend(difflib.unified_diff(old,new,fromfile='a/'+name if old else '/dev/null',tofile='b/'+name))
Path('outputs/etapa3/alteracoes.patch').write_text(''.join(patch),encoding='utf-8')
print('Relatório, roteiro e patch registrados.')

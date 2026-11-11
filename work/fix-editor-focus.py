from pathlib import Path
p=Path('assets/proposal/proposal-demo.js');s=p.read_text(encoding='utf-8').replace("c.onchange=()=>{change(c.value);confirmed=false;};", "c.onchange=()=>{inputEditing=true;try{change(c.value);confirmed=false;}finally{inputEditing=false;}if(items)render();};");p.write_text(s,encoding='utf-8')

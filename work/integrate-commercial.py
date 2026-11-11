from pathlib import Path
p=Path('backend/demo.cjs');s=p.read_text(encoding='utf-8');s=s.replace("  const errors = new Map();","  const commercial=require('./commercial.cjs').createCommercial(db);\n  const errors = new Map();")
needle="        if(req.method==='GET'&&pathname==='/api/draft'){";idx=s.index(needle);s=s[:idx]+"""        const commercialMatch=/^\\/api\\/quotes\\/([a-f0-9-]{36})\\/commercial(?:\\/(draft|publish|approve|event|correction))?$/.exec(pathname);
        if(req.method==='GET'&&commercialMatch){try{return respond(200,commercial.handle(commercialMatch[1],user,req.method,commercialMatch[2]));}catch(e){if(e.status)return respond(e.status,{error:e.message});throw e;}}
"""+s[idx:];needle="        if(req.method==='POST'&&pathname==='/api/draft'){";idx=s.index(needle);s=s[:idx]+"""        if(commercialMatch){try{return respond(200,commercial.handle(commercialMatch[1],user,req.method,commercialMatch[2],body));}catch(e){if(e.status)return respond(e.status,{error:e.message});throw e;}}
"""+s[idx:];p.write_text(s,encoding='utf-8')

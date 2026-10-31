import json, re, sys
EMAILS = len(sys.argv)>1 and sys.argv[1]=='--emails'
if EMAILS: sys.argv.pop(1)
BASE = 'src/messages/emails' if EMAILS else 'src/messages'
en = json.load(open(BASE+'/en.json'))
PH = re.compile(r'\{(\w+)\}')
def walk(a, b, path, errs):
    if isinstance(a, dict):
        if not isinstance(b, dict): errs.append(f'{path}: expected object'); return
        for k in a:
            if k not in b: errs.append(f'{path}.{k}: missing')
            else: walk(a[k], b[k], f'{path}.{k}', errs)
        for k in b:
            if k not in a: errs.append(f'{path}.{k}: extra key')
    elif isinstance(a, list):
        if not isinstance(b, list) or len(a) != len(b): errs.append(f'{path}: array length {len(a)} vs {len(b) if isinstance(b,list) else "n/a"}'); return
        for i,(x,y) in enumerate(zip(a,b)): walk(x,y,f'{path}[{i}]',errs)
    elif isinstance(a, str):
        if not isinstance(b, str) or not b.strip(): errs.append(f'{path}: empty/not string'); return
        if sorted(PH.findall(a)) != sorted(PH.findall(b)): errs.append(f'{path}: placeholders {PH.findall(a)} vs {PH.findall(b)}')
ok = True
for loc in sys.argv[1:]:
    try: d = json.load(open(BASE+'/'+loc+'.json'))
    except Exception as e: print(loc, 'INVALID JSON', e); ok=False; continue
    errs=[]; walk(en, d, loc, errs)
    # demo ids and app names must stay
    for i,(x,y) in enumerate(zip(en.get('demos',[]), d.get('demos',[]))):
        if x['id']!=y.get('id'): errs.append(f'demos[{i}].id changed')
    print(loc, 'OK' if not errs else f'{len(errs)} errors'); [print('  ',e) for e in errs[:15]]
    ok = ok and not errs
sys.exit(0 if ok else 1)

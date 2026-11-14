import re,subprocess,json,pathlib
out=pathlib.Path('work-qa-fleet100');checks=re.findall(r'run: node ([^\s]+\.cjs)',pathlib.Path('.github/workflows/pages.yml').read_text())
checks+=['verify-fleet100.cjs','verify-fleet100-physics.cjs','verify-fleet100-helicopters.cjs']
checks=list(dict.fromkeys(checks))
r=[]
for f in checks:
 p=subprocess.run(['node',f],capture_output=True,text=True,encoding='utf-8',errors='replace');r.append({'test':f,'exit':p.returncode});(out/(f+'.log')).write_text(p.stdout+p.stderr,encoding='utf-8')
 if p.returncode:print('FAIL',f,p.stderr[-600:],flush=True)
print('CHECKS',len(r),'FAILED',[x['test'] for x in r if x['exit']],flush=True)
(out/'regression-results.json').write_text(json.dumps(r,indent=2),encoding='utf-8')

"""Build a versioned RGB spatial index from public TCGdex reference images.
Run: python tools/build_visual_index.py (requires Pillow and numpy).
No uploaded user photographs are used. Failed references are counted explicitly.
"""
import concurrent.futures as cf, json, pathlib, urllib.request, time, io, argparse
import numpy as np
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parent.parent
REGIONS=[(.06,.04,.94,.96),(.08,.10,.92,.49)]
BOXES=np.array([(int((x0+(x1-x0)*x/12)*96),int((y0+(y1-y0)*y/12)*132),int((x0+(x1-x0)*(x+1)/12)*96),int((y0+(y1-y0)*(y+1)/12)*132)) for x0,y0,x1,y1 in REGIONS for y in range(12) for x in range(12)])
def descriptor(im):
 a=np.asarray(im.convert('RGB').resize((96,132),Image.Resampling.BILINEAR),dtype=np.int64)
 summed=np.pad(a.cumsum(0).cumsum(1),((1,0),(1,0),(0,0)))
 l,t,r,b=BOXES.T
 values=(summed[b,r]-summed[t,r]-summed[b,l]+summed[t,l])/((r-l)*(b-t))[:,None]
 return np.floor(values+.5).astype('uint8').tobytes()

def get(url):
 req=urllib.request.Request(url,headers={'User-Agent':'ProfessionalCardInspection-reference-index/1.9'})
 with urllib.request.urlopen(req,timeout=15) as r:return r.read()
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--workers',type=int,default=12);ap.add_argument('--cached-only',action='store_true');ap.add_argument('--language',choices=['en','ja'],default='en');args=ap.parse_args()
 cache=ROOT/('ref-cache' if args.language=='en' else 'ref-cache-ja');cache.mkdir(exist_ok=True);out=ROOT/'data';out.mkdir(exist_ok=True);stem='visual-index' if args.language=='en' else 'visual-index-ja'
 cards=json.loads(get('https://api.tcgdex.net/v2/'+args.language+'/cards'))
 catalog_count=len(cards)
 cards=[c for c in cards if c.get('image','').startswith('https://assets.tcgdex.net/'+args.language+'/') and not __import__('re').match(r'^(A\d|P-A|B\d)',c['id'])]
 print('References with images:',len(cards),flush=True)
 def process(c):
  path=cache/(c['id'].replace('/','_')+'.jpg')
  if args.cached_only and not path.exists():return c,None
  for attempt in range(2):
   try:
    b=path.read_bytes() if path.exists() else get(c['image']+('/low.webp' if attempt==0 else '/low.jpg'))
    im=Image.open(io.BytesIO(b));d=descriptor(im)
    if not path.exists():path.write_bytes(b)
    return c,d
   except Exception:
    if path.exists():path.unlink(missing_ok=True)
    if attempt: return c,None
    time.sleep(.4)
 results={};failed=[];start=time.monotonic()
 # Preserve valid existing index entries if a remote reference is temporarily unavailable.
 try:
  previous=json.loads((out/(stem+'.json')).read_text());previous_bytes=(out/(stem+'.bin')).read_bytes()
  if previous['version']=='rgb-regions-12-v2' and len(previous_bytes)==previous['count']*864:
   current_ids={c['id'] for c in cards}
   for i,c in enumerate(previous['cards']):
    if c['id'] in current_ids:results[c['id']]=(c,previous_bytes[i*864:(i+1)*864])
 except (OSError,KeyError,ValueError):pass
 with cf.ThreadPoolExecutor(max_workers=args.workers) as pool:
  for i,(c,d) in enumerate(pool.map(process,cards),1):
   if d:results[c['id']]=(c,d)
   else:failed.append(c['id'])
   if i%250==0:print(i,'/',len(cards),'failed',len(failed),'elapsed',round(time.monotonic()-start),flush=True)
 ordered=[results[k] for k in sorted(results)]
 meta={'version':'rgb-regions-12-v2','created':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'language':args.language,'source':'https://api.tcgdex.net/v2/'+args.language+'/cards','catalogCount':catalog_count,'eligible':len(cards),'count':len(ordered),'failedCount':max(0,len(cards)-len(ordered)),'stride':864,'cards':[{k:c[k] for k in ['id','name','localId','image']} for c,d in ordered]}
 if not ordered:raise SystemExit('No reference images available; keeping existing data.')
 (out/(stem+'.json')).write_text(json.dumps(meta,separators=(',',':'),ensure_ascii=False))
 (out/(stem+'.bin')).write_bytes(b''.join(d for c,d in ordered))
 print('DONE',meta['count'],'of',meta['eligible'],'bytes',(out/(stem+'.bin')).stat().st_size,flush=True)
if __name__=='__main__':main()

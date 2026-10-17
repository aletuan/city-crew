# Rule v0 for photo type (food / place / scenery / unsure), frozen 17 Oct 2026
# before any hand label: see round1.json beside this and Q4 in
# docs/photo-critic.md. Reads the labels Vision stored in photo_scores.
FOOD = {'food','plate','bowl','pizza','sushi','seafood','vegetable','seasonings','condiment','coffee','drink',
        'cup','liquid','frozen','fork','dessert','baked_goods','bread','cake','fruit','meat','noodles','pasta','salad',
        'sandwich','burger','ice_cream','beverage','wine','cocktail','tea','soup','rice','egg','cheese','chocolate'}
SKY = {'sky','blue_sky','cloudy','night_sky','land','water','sunset_sunrise','mountain','sea','beach','river','lake','cityscape','skyscraper'}
ROOM = {'interior_room','restaurant','bar','furniture','sofa','armchair','library','bookshelf'}
FRONT = {'portal','door','storefront','arch','building','sign','window'}
def parse(L):
    out={}
    for tok in (L or '').split():
        k,v=tok.rsplit(':',1); out[k]=float(v)
    return out
def kind(r):
    l=parse(r['L'])
    food=max([p for k,p in l.items() if k in FOOD], default=0)
    sky=max([p for k,p in l.items() if k in SKY], default=0)
    room=max([p for k,p in l.items() if k in ROOM], default=0)
    front=max([p for k,p in l.items() if k in FRONT], default=0)
    sub=r['sub'] or 0
    if food>=0.5 and room<0.5 and sky<0.5: return 'food'
    if sky>=0.6 and food<0.3 and room<0.5 and front<0.5: return 'scenery'
    if food>=0.5 or sky>=0.6: return 'unsure'
    return 'place'

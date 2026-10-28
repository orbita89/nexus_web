import sys
from PIL import Image, ImageOps

src, dst = sys.argv[1], sys.argv[2]
# Тритон: тени — глубокий фиолетовый, средние тона — индиго/violet, света — янтарь бренда.
STOPS = [(0.00, (10, 6, 24)), (0.35, (46, 16, 101)), (0.62, (91, 33, 182)), (0.84, (147, 92, 232)), (0.94, (194, 110, 60)), (1.00, (245, 170, 70))]

def ramp(t):
    for (a, ca), (b, cb) in zip(STOPS, STOPS[1:]):
        if t <= b:
            k = 0 if b == a else (t - a) / (b - a)
            return tuple(round(ca[i] + (cb[i] - ca[i]) * k) for i in range(3))
    return STOPS[-1][1]

lut = [ramp(i / 255) for i in range(256)]
g = Image.open(src).convert('L')
out = Image.merge('RGB', [g.point([c[i] for c in lut]) for i in range(3)])
out.save(dst)
print(out.size)

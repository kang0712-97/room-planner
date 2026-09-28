# t31 용 «압축이 안 되는» 큰 JPEG. 씨앗을 고정해 늘 같은 파일이 나온다(도면 저장 글자 수가 매번 같도록).
import random, sys
from PIL import Image
W, H = 3000, 2200
rnd = random.Random(20260928)
Image.frombytes("RGB", (W, H), rnd.randbytes(W * H * 3)).save(sys.argv[1] if len(sys.argv) > 1 else "photo.jpg", quality=92)

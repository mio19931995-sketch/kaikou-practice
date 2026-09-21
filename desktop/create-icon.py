from pathlib import Path
from PIL import Image, ImageDraw

out = Path(__file__).parent
im = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
draw = ImageDraw.Draw(im)
draw.rounded_rectangle((12, 12, 500, 500), radius=144, fill='#30482f')
for x, top, bottom in [(152, 200, 312), (224, 136, 376), (296, 176, 336), (368, 224, 288)]:
    draw.rounded_rectangle((x-16, top, x+16, bottom), radius=16, fill='#c3eba0')
im.save(out / 'icon.png')
im.save(out / 'icon.ico', sizes=[(16,16), (24,24), (32,32), (48,48), (64,64), (128,128), (256,256)])

# Icon-Quellen

Nur Vorlagen. Diese Dateien werden **nicht** ausgeliefert; die fertigen PNGs liegen in `public/`
und werden von Hand erzeugt, nicht bei jedem Build.

- `icon-opaque.svg` -> `public/apple-touch-icon-180x180.png`. Randlos und ohne Eckenrundung, weil
  iOS keine Transparenz im apple-touch-icon kann und sonst Schwarz unterlegt. Die Rundung macht iOS.
- `icon-maskable.svg` -> `public/maskable-icon-512x512.png`. Vollflaechiger Grund, Glyph auf 72 %,
  damit es die kreisfoermige Maske eines Android-Launchers uebersteht.
- `public/favicon.svg` -> `public/pwa-192x192.png` und `public/pwa-512x512.png` (purpose "any").

Die weissen Pfade sind in beiden Vorlagen woertlich aus `public/favicon.svg` uebernommen. Wer das
Symbol aendert, aendert es dort und erzeugt danach alles neu - sonst laufen Favicon und App-Icon
auseinander.

## Neu erzeugen

`sharp-cli` steht bewusst **nicht** in `package.json`: Es haengt am nativen `sharp`, und CI wuerde
bei jedem Build rund 30 MB fuer ein Werkzeug laden, das dort nie laeuft. Ueber `npx` einmalig:

```bash
npx --yes sharp-cli@latest --input public/favicon.svg --output public/pwa-512x512.png resize 512 512
npx --yes sharp-cli@latest --input public/favicon.svg --output public/pwa-192x192.png resize 192 192
npx --yes sharp-cli@latest --input build/icons/icon-maskable.svg --output public/maskable-icon-512x512.png resize 512 512
npx --yes sharp-cli@latest --input build/icons/icon-opaque.svg --output public/apple-touch-icon-180x180.png resize 180 180
```

Danach pruefen: Das apple-touch-icon muss in allen vier Ecken deckend sein (Alpha 255), und beim
maskierbaren Icon muss jedes weisse Pixel innerhalb eines Kreises mit 80 % des Bilddurchmessers
liegen. Beides faellt sonst erst auf einem echten Geraet auf.

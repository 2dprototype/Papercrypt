# Papercrypt

Store any file or text as a set of QR codes (on paper, on screen, in a ZIP of PNGs) and restore it later by scanning.
Runs 100% in the browser — nothing is uploaded.

## Use
Cameras require HTTPS or localhost, so serve the folder:

    python3 -m http.server 8000     # then open http://localhost:8000

* **Generate** – pick a file (or type text), choose options, get: PNG ZIP, printable sheet, or an on‑screen looping player.
* **Scan & Restore** – camera, image files, or pasted text. Order doesn't matter, duplicates are ignored, a live grid shows which chunks are missing. Original file name/type is restored.

## Features
* Deflate compression (kept only if it actually shrinks the data)
* Optional password: AES‑256‑CBC + HMAC‑SHA256, PBKDF2 (100k iterations) — wrong password / tampering is detected
* Parity QRs: 1 extra code per N data codes lets you lose any one code per group and still restore
* Per‑chunk CRC32, whole‑file SHA‑256 integrity check
* Integer‑pixel QR rendering with proper quiet zone (much more reliable scanning than scaled canvases)
* Bytes‑per‑QR auto‑clamped to the capacity of the chosen error‑correction level

## Tips
* Smaller chunks (≈300–500 bytes) scan far more reliably from a phone camera than max‑size codes.
* Use parity (e.g. 5) for anything printed.
* Scanning uses the browser's native `BarcodeDetector` when available (Chrome/Android/Edge). Otherwise it loads
  `jsQR` — drop `jsQR.js` (https://github.com/cozmo/jsQR, `dist/jsQR.js`) into `lib/` to make that fully offline;
  otherwise it falls back to the jsDelivr CDN.

## Wire format (PC2)
    PC2|<id>|<i>|<n>|<g>|<flags>|<L>|<crc32>\n<base64 chunk>
`i` = data index or `p<k>` (parity of group k) · `n` data chunks · `g` parity group size · flags `z`=deflate `e`=encrypted · `L` stream length.
Stream = [deflate]( u32 metaLen | meta JSON {name,mime,size,sha} | data ) then optional encryption `salt|iv|ciphertext|hmac`.

## Tests
    node tests/codec.test.js

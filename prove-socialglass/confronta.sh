#!/bin/bash
norm(){ sed -E 's/SG[0-9A-F]{7}/SGxxxx/g; s/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z/DATA/g; s/[0-9]{2}\/[0-9]{2}\/[0-9]{4}/DATA/g; s/[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?/ORA/g; s/(tr|in|cus|sub|pi|cs)_[A-Za-z0-9]+/ID/g; s/[0-9a-f]{8}/HEX/g; s/SEG[0-9]+/SEGxx/g' "$1"; }
for t in "$@"; do d=$(diff <(norm base/$t.out) <(norm nuovo/$t.out)); if [ -z "$d" ]; then echo "$t: uguale"; else echo "=== $t:"; echo "$d" | head -30; fi; done

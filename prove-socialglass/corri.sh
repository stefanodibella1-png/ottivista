#!/bin/bash
# corri.sh CARTELLA_ESITI test1 test2 ...  (server nuovo per ogni prova)
OUT=$1; shift; mkdir -p $OUT
for t in "$@"; do
  case $t in
    notte13) S="srv.js"; X="NOTTE_MAX=4";;
    casi11) S="srv-viaggio.js"; X="";;
    m1|m2) S="srv-prova.js"; X="";;
    adm17|ui17|adm18) S="srv17.js"; X="";;
    caf19|pc19|cont19) S="srv19.js"; X="";;
    cf20|cf22|rin22|fine21|fine22) S="srv20.js"; X="";;
    dup23d) S="srv23.js"; X="";;
    pc24|ui24) S="srv24.js"; X="";;
    adm24) S="srv25.js"; X="";;
    ui24b) S="srv.js"; X="SENZA_CONFERMA=";;
    *) S="srv.js"; X="";;
  esac
  pkill -f "node srv" ; sleep 0.5
  (env SENZA_CONFERMA=1 $X CRON_SECRET=prova STRIPE_WEBHOOK_SECRET=whsec_prova node $S > $OUT/$t.srv.log 2>&1 &)
  sleep 2
  if [ -f $t.py ]; then timeout 400 python3 $t.py > $OUT/$t.out 2>&1; else timeout 300 node $t.cjs > $OUT/$t.out 2>&1; fi
  echo "$t: exit $? · $(grep -c '' $OUT/$t.out) righe · NO=$(grep -c '^NO' $OUT/$t.out) · Traceback=$(grep -c Traceback $OUT/$t.out)"
done
pkill -f "node srv"

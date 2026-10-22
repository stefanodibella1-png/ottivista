const {send, DEMO, MODO, CFG, wrap} = require("./_lib");
module.exports = wrap(async (req, res) => send(res, 200, {ok: true, demo: DEMO, db: MODO, stripe: !!CFG.stripeKey}));

const {send, DEMO, wrap} = require("./_lib");
module.exports = wrap(async (req, res) => send(res, 200, {ok: true, demo: DEMO, stripe: !!require("./_lib").CFG.stripeKey}));

const { Logger } = require('channelape-logger');
const { LogLevel } = require('channelape-sdk');
const LOGGER = new Logger('webhook-service', LogLevel.INFO);

module.exports.isEstablishingWebHookProcess = req => req && req.headers && req.headers['x-hook-secret'];

module.exports.handleHandShake = (req, res) => {
    LOGGER.debug('Confirmation handshake with an X-Hook-Secret header: ' + req.headers[ 'x-hook-secret' ]);

    res
        .set("x-hook-secret", req.headers[ 'x-hook-secret' ])
        .sendStatus(200);
};

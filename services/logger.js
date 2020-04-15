const log4js = require('log4js');
log4js.configure({
    appenders: { console: { type: 'console',layout: { type: "basic" } } },
    categories: { default: { appenders: [ 'console' ], level: 'info' } }
  });
const logger = log4js.getLogger('Asana-Subscriber');


module.exports.debug = msg => logger.debug(msg);

module.exports.info = msg => logger.info(msg);

module.exports.error = msg => logger.error(msg);
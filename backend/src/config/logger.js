const pinoHttp = require('pino-http');

const logger = pinoHttp({
  name: 'backend-logger',
  transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty', options: { colorize: true } },
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
});

module.exports = logger;

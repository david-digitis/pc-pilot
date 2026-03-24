const pino = require('pino');

const logger = pino({
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

module.exports = logger;

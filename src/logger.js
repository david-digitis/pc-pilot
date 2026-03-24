const pino = require('pino');

const logger = pino({
  transport: {
    target: 'pino/file',
    options: { destination: 1 }, // stdout
  },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

module.exports = logger;

const { ZodError } = require('zod');

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Endpoint tidak ditemukan' });
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof ZodError) {
    const message = err.issues.map((issue) => issue.message).join(', ');
    return res.status(400).json({ error: message });
  }

  if (err.code === 'ENOENT') {
    return res.status(404).json({ error: 'Sumber tidak ditemukan' });
  }

  console.error(err); // eslint-disable-line no-console
  return res.status(500).json({ error: 'Terjadi kesalahan internal. Silakan coba lagi.' });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};

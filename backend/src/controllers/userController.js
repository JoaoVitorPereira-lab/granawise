function me(req, res) {
  res.json({ usuario: req.usuario });
}

module.exports = { me };
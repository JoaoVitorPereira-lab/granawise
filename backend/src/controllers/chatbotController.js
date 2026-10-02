const chatbotService = require('../services/chatbotService');

function menu(req, res, next) {
  try {
    res.json(chatbotService.menu());
  } catch (err) { next(err); }
}

function responder(req, res, next) {
  try {
    res.json(chatbotService.responder(req.usuario.id, req.params.option, req.query));
  } catch (err) { next(err); }
}

module.exports = { menu, responder };
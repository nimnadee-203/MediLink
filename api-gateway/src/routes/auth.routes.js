const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
  res.send('Login routed to auth-service');
});

module.exports = router;

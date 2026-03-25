const express = require('express');
const app = express();
const port = 8005;

app.get('/', (req, res) => {
  res.send('Payment Service is running');
});

app.listen(port, () => {
  console.log(`Payment Service listening at http://localhost:${port}`);
});

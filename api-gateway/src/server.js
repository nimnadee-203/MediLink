const express = require('express');
const app = express();
const port = 8000;

app.get('/', (req, res) => {
  res.send('API Gateway is running');
});

app.listen(port, () => {
  console.log(`API Gateway listening at http://localhost:${port}`);
});

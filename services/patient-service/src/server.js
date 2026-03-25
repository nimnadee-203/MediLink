const express = require('express');
const app = express();
const port = 8002;

app.get('/', (req, res) => {
  res.send('Patient Service is running');
});

app.listen(port, () => {
  console.log(`Patient Service listening at http://localhost:${port}`);
});

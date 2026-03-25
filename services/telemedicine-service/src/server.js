const express = require('express');
const app = express();
const port = 8007;

app.get('/', (req, res) => {
  res.send('Telemedicine Service is running');
});

app.listen(port, () => {
  console.log(`Telemedicine Service listening at http://localhost:${port}`);
});

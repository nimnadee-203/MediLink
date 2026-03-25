const express = require('express');
const app = express();
const port = 8003;

app.get('/', (req, res) => {
  res.send('Doctor Service is running');
});

app.listen(port, () => {
  console.log(`Doctor Service listening at http://localhost:${port}`);
});

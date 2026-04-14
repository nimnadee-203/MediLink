const express = require('express');
const notificationRoutes = require('./routes/notification.routes');
const app = express();
const port = 8000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('API Gateway is running');
});

app.use('/notifications', notificationRoutes);

app.listen(port, () => {
  console.log(`API Gateway listening at http://localhost:${port}`);
});

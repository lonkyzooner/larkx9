const express = require('express');
const path = require('path');
const app = express();
const port = 8088;

// Serve static files from the current directory
app.use(express.static(__dirname));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`LARK web interface running at http://localhost:${port}`);
  console.log(`Access from other devices at http://<your-ip-address>:${port}`);
});

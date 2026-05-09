const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// serve static files (HTML or CSS or JS) from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// for parsing JSON bodies sent from the frontend
app.use(express.json());

// start the server
app.listen(PORT, () => {
  console.log('GUI server running on http://localhost:' + PORT);
});

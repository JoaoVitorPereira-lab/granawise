const db = require('../src/database/db');

afterAll(() => {
  db.close();
});
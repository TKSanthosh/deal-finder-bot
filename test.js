const axios = require('axios');
async function check() {
  const res = await axios.get('https://t.me/s/GoPaisa');
  const matches = res.data.match(/data-post="GoPaisa\/(\d+)"/g);
  console.log(matches.slice(-5));
}
check();

import axios from 'axios';

async function check() {
  const res1 = await axios.get('https://t.me/s/idoffers');
  const matches1 = [...res1.data.matchAll(/data-post="idoffers\/(\d+)"/g)];
  console.log('idoffers latest:', matches1.length > 0 ? matches1[matches1.length - 1][1] : 'none');

  const res2 = await axios.get('https://t.me/s/GoPaisa');
  const matches2 = [...res2.data.matchAll(/data-post="GoPaisa\/(\d+)"/g)];
  console.log('GoPaisa latest:', matches2.length > 0 ? matches2[matches2.length - 1][1] : 'none');
}
check();

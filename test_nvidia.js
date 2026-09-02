const axios = require('axios');
(async () => {
  try {
    const res = await axios.post('https://integrate.api.nvidia.com/v1/chat/completions', {
      model: 'meta/llama3-70b-instruct',
      messages: [{ role: 'user', content: 'test' }]
    }, {
      headers: { 'Authorization': `Bearer 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` }
    });
    console.log(res.status, res.data.choices[0].message.content);
  } catch (e) {
    console.error(e.response ? e.response.status + ' ' + JSON.stringify(e.response.data) : e.message);
  }
})();

self.onmessage = function (e) {
    if (e.data === 'load') {
      fetch('../data/cast.json')
        .then(response => response.json())
        .then(data => {
          data.forEach(row => {
            if (Array.isArray(row.professions)) {
              row.professions = row.professions.join(', ');
            } else if (!row.professions) {
              row.professions = '';
            }
          });
          self.postMessage(data);
        })
        .catch(err => {
          console.error('Worker fetch error:', err);
          self.postMessage([]);
        });
    }
  };
  
var restify = require('restify');

var client = restify.createJsonClient({
	url: 'http://127.0.0.1:5000'
});

client.get('/', function(err, req, res, obj) {
	if (err) {
		console.log('Error: ' + err);
		return;
	}
	console.log(JSON.stringify(obj));
});


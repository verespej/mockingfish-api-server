var restify = require('restify');
var bunyan = require('bunyan');
var fs = require('fs');

var log = new bunyan.createLogger({
	name: 'mockingfish-api-server',
	serializers: {
		req: bunyan.stdSerializers.req
	}
});

var server = restify.createServer({
	name: 'mockingfish-api-server',
	version: '0.0.1',
	log: log
});

server.pre(restify.pre.userAgentConnection()); // For curl
server.pre(function(req, res, next) {
	req.log.info({ req: req }, 'Received request');
	next();
});

server.use(restify.acceptParser(server.acceptable));
server.use(restify.queryParser());
server.use(restify.bodyParser());
server.use(restify.requestLogger());

server.get('/', function(req, res, next) {
	res.send('Welcome to the MockingFish API');
	return next();
});

// List editable videos
server.get('/videos', function(req, res, next) {
	fs.readdir(__dirname + '/videos', function(err, files) {
		if (err) {
			res.status(500).send({ msg: 'Error reading file', error: err });
			return next(err);
		}
		var list = files.map(function(fileName) {
			return {
				id: fileName,
				path: '/videos/' + fileName
			};
		});
		res.send(list);
		return next();
	});
});

// Get editable video
server.get('/videos/', restify.serveStatic({
	directory: __dirname
}));

server.listen(process.env.PORT || 5000, function() {
	console.log(server.name + ' listening at ' + server.url);
});


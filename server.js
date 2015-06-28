var fs = require('fs');
var path = require('path');
var restify = require('restify');
var bunyan = require('bunyan');
var tmp = require('tmp');

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
//server.use(restify.bodyParser());
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

// List video mixes
server.get('/mixes', function(req, res, next) {
	fs.readdir(__dirname + '/mixes', function(err, files) {
		if (err) {
			res.status(500).send({ msg: 'Error reading file', error: err });
			return next(err);
		}
		var list = files.map(function(fileName) {
			return {
				id: fileName,
				path: '/mixes/' + fileName
			};
		});
		res.send(list);
		return next();
	});
});

// Get video mix
server.get('/mixes/', restify.serveStatic({
	directory: __dirname
}));

// List audio clips
server.get('/clips', function(req, res, next) {
	fs.readdir(__dirname + '/clips', function(err, files) {
		if (err) {
			res.status(500).send({ msg: 'Error reading file', error: err });
			return next(err);
		}
		var list = files.map(function(fileName) {
			return {
				id: fileName,
				path: '/clips/' + fileName
			};
		});
		res.send(list);
		next();
	});
});

// Get audio clip
server.get('/clips/', restify.serveStatic({
	directory: __dirname
}));

// Post audio clip
server.post('/clips', function(req, res, next) {
	// TODO: Use hash instead of tmp name
	// TODO: Get audio format from request
	tmp.tmpName({
		dir: __dirname + '/clips/',
		prefix: 'clip-',
		postfix: '.mp3',
		keep: true
	}, function(err, fPath) {
		if (err) {
			res.status(500).send({ msg: 'Error creating temp file name', error: err });
			next(err);
		}
			
		req.log.info('Initiating upload to ' + fPath);

		var ws = fs.createWriteStream(fPath);
		var rs = req.pipe(ws);

		rs.on('drain', function() {
			req.log.info('Data segment uploaded...');
		});

		rs.on('finish', function() {
			req.log.info('Upload complete ' + path.basename(fPath));
			res.send({ id: path.basename(fPath) });
		});

		next();
	});
});

server.listen(process.env.PORT || 5000, function() {
	console.log(server.name + ' listening at ' + server.url);
});


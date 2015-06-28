var Promise = require('bluebird');
var fs = require('fs');
var path = require('path');
var restify = require('restify');
var bunyan = require('bunyan');
var tmp = require('tmp');
var ffmpeg = require('fluent-ffmpeg');

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
server.use(restify.requestLogger());

server.get('/', function(req, res, next) {
	res.send('Welcome to the MockingFish API');
	return next();
});

// Serve app pages
server.get('/app/:page', restify.serveStatic({
	directory: __dirname
}));

// List editable videos
server.get('/videos', function(req, res, next) {
	listDir('videos', req, res, next);
});

// Get editable video
server.get('/videos/:id', restify.serveStatic({
	directory: __dirname
}));

// List video mixes
server.get('/mixes', function(req, res, next) {
	listDir('mixes', req, res, next);
});

// Get video mix
server.get('/mixes/:id', restify.serveStatic({
	directory: __dirname
}));

// Create mix
server.post('/mixes', restify.jsonBodyParser(), function(req, res, next) {
console.log(req.body);
	var params = req.body;
	if (typeof(req.body) === 'string') {
		params = JSON.parse(req.body);
	}

	var tmpDir = path.join(__dirname, 'tmp');
	var baseFileName = path.parse(params.video).name;
	var baseVideoFile = path.join(__dirname, 'videos', params.video);
	var baseAudioFile = path.join(tmpDir, baseFileName + '.mp3');
	var replacementAudioFile = path.join(__dirname, 'clips', params.splices[0].audio);
	var splitStart = params.splices[0].location;
	var baseDuration;
	var replacementDuration;

	console.log({
		tmpDir : tmpDir,
		baseFileName : baseFileName,
		baseVideoFile : baseVideoFile,
		baseAudioFile : baseAudioFile,
		replacementAudioFile : replacementAudioFile,
		splitStart : splitStart
	});


	// TODO: Cache audio file to avoid recreation
	console.log("starting");
	extractAudio(baseVideoFile, baseAudioFile).then(function(aFile) {
		return getAudioDuration(aFile).then(function(d) {
			baseDuration = d;
		});
	}).then(function() {
		return getAudioDuration(replacementAudioFile).then(function(d) {
			replacementDuration = d;
		});
	}).then(function() {
		// split audio 0 to start
		return splitAudio(
			baseAudioFile,
			0,
			splitStart,
			baseAudioFile + '.1.mp3'
		);
	}).then(function(start) {
		// split audio start to duration
		return splitAudio(
			baseAudioFile,
			splitStart,
			splitStart + replacementDuration,
			baseAudioFile + '.2.mp3'
		);
	}).then(function() {
		// split audio duration to end
		return splitAudio(
			baseAudioFile,
			splitStart + replacementDuration,
			baseDuration - (splitStart + replacementDuration),
			baseAudioFile + '.3.mp3'
		);
	}).then(function() {
		return concatAudio(
			baseAudioFile + '.1.mp3',
			replacementAudioFile,
			baseAudioFile + '.3.mp3',
			tmpDir,
			baseAudioFile + '.final.mp3'
		);
	}).then(function(aFile) {
		return replaceAudio(
			baseVideoFile,
			aFile,
			getRandomFileName('mixes', 'mix-', 'mp4')
		);
	}).then(function(vFile) {
		console.log('Success: ' + vFile);
		res.send({ output: vFile });
	}).catch(function(err) {
		console.log(err);
		res.status(500).send(err);
	});

	next();

});

function getAudioDuration(aFile) {
	return new Promise(function(resolve, reject) {
		ffmpeg.ffprobe(aFile, function(err, metadata) {
			if (err) {
				console.log('Error getting audio duration: ' + err.message);
				reject({ msg: 'Error getting audio duration', error: err });
			}
			console.log('Getting audio duration succeeded: ' + metadata.format.duration);
			resolve(metadata.format.duration);
		});
	});
}

function extractAudio(vFile, output) {
	return new Promise(function(resolve, reject) {
		ffmpeg(vFile)
			.audioCodec('libmp3lame')
			.on('error', function(err) {
				console.log('Error extracting audio from video: ' + err.message);
				reject({ msg: 'Error extracting audio from video', error: err });
			})
			.on('end', function() {
				console.log('Audio extraction succeeded: ' + output);
				resolve(output);
			})
			.save(output);
	});
}

function splitAudio(aFile, start, duration, output) {
	return new Promise(function(resolve, reject) {
		ffmpeg(aFile)
			.addOptions([
				'-ss ' +  start,
				'-t ' + duration
			])
			.on('error', function(err) {
				console.log('Error splitting audio: ' + err.message);
				reject({ msg: 'Error splitting audio', error: err });
			})
			.on('end', function() {
				console.log('Splitting audio succeeded: ' + output);
				resolve(output);
			})
			.save(output);
	});
}

function concatAudio(input1, input2, input3, tmpDir, output) {
	return new Promise(function(resolve, reject) {
		ffmpeg(input1).addInput(input2).addInput(input3)
			.on('error', function(err) {
				console.log('Error concatenating audio: ' + err.message);
				reject({ msg: 'Error concatenating audio', error: err });
			})
			.on('end', function() {
				console.log('Audio concat succeeded: ' + output);
				resolve(output);
			})
			.mergeToFile(output, tmpDir);
	});
}

function replaceAudio(vFile, aFile, output) {
	return new Promise(function(resolve, reject) {
		console.log({
			vFile: vFile,
			aFile: aFile,
			output: output
		});
		ffmpeg(vFile).addInput(aFile)
			.addOptions(['-map 0:0', '-map 1:0', '-c:v copy', '-c:a copy'])
			.on('error', function(err) {
				console.log('Error replacing audio: ' + err);
				reject({ msg: 'Error replacing audio', error: err });
			})
			.on('end', function() {
				console.log('Audio replacement succeeded: ' + output);
				resolve(output);
			})
			.save(output);
	});
}

// List audio clips
server.get('/clips', function(req, res, next) {
	listDir('clips', req, res, next);
});

// Get audio clip
server.get('/clips/:id', restify.serveStatic({
	directory: __dirname
}));

// Post audio clip
server.post('/clips', function(req, res, next) {
	// TODO: Use hash instead of tmp name
	// TODO: Get audio format (& extension) from request
	var fPath = getRandomFileName('clips', 'clip-', 'mp3');
	req.log.info('Initiating upload to ' + fPath);
	var ws = fs.createWriteStream(fPath);
	var rs = req.pipe(ws);

	rs.on('drain', function() {
		req.log.info('Data segment saved...');
	});

	rs.on('finish', function() {
		req.log.info('Upload complete ' + path.basename(fPath));
		res.send({ id: path.basename(fPath) });
	});

	next();
});

server.post('/clips2', restify.bodyParser(), function(req, res, next) {
	var fPath = getRandomFileName('clips', 'clip-', 'wav');
	req.log.info('Saving web upload to ' + fPath);
	fs.renameSync(req.files.data.path, fPath);
	res.send({ id: path.basename(fPath) });
	next();
});

// List tmp dir
server.get('/tmp', function(req, res, next) {
	listDir('tmp', req, res, next);
});

// Get tmp items
server.get('/tmp/:id', restify.serveStatic({
	directory: __dirname
}));

function listDir(dirName, req, res, next) {
	fs.readdir(path.join(__dirname, dirName), function(err, files) {
		if (err) {
			res.status(500).send({ msg: 'Error reading file', error: err });
			return next(err);
		}
		var list = files.map(function(fileName) {
			return {
				id: fileName,
				path: path.join('/', dirName, fileName)
			};
		});
		res.send(list);
		return next();
	});
}

function getRandomFileName(subdir, prefix, ext) {
	return tmp.tmpNameSync({
		dir: path.join(__dirname, subdir),
		prefix: prefix,
		postfix: '.' + ext,
		keep: true
	});
}

server.listen(process.env.PORT || 5000, function() {
	console.log(server.name + ' listening at ' + server.url);
});


API server for MockingFish app

TODO: Create own copy of ffmpeg for use with build pack
When configuring, must:
 heroku buildpacks:set https://github.com/ddollar/heroku-buildpack-multi.git


To upload a clip:
 curl -H "Content-Type: audio/mpeg" -F clip=@"javascript-soundbite.mp3" http://127.0.0.1:5000/clips

To create a mix:
 curl -d "{ \"video\":\"no-stop-it.mp4\", \"splices\":[{ \"audio\":\"javascript-soundbite.mp3\",\"location\":1 }] }" http://127.0.0.1:5000/mixes


Issues:
 In mix post, errors aren't sent to client (e.g. for malformed input)


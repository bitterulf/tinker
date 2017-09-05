const Hapi = require('hapi');
const config = require('./config.json');
const fs = require('fs');
const download = require('download');
const unzip = require('unzip');
const copy = require('recursive-copy');
const rmdir = require('rmdir');
const exec = require('child_process').exec;

const server = new Hapi.Server();

server.connection({
    host: 'localhost',
    port: 8000
});

const downloadContent = function(contentUrl, contentDirectory, tempDir, cb) {
    download(contentUrl).then(data => {

        fs.writeFile(tempDir+'/content.zip', data, function() {
            const writeStream = unzip.Extract({ path: tempDir });
            const readStream = fs.createReadStream(tempDir+'/content.zip');
            readStream.pipe(writeStream);

            writeStream.on('finish', function () {
                setTimeout(function() {
                    copy(tempDir+'/'+contentDirectory, tempDir+'/build/content', function(err, results) {
                        cb();
                    });
                }, 100);
            });
        });
    });
};

const downloadGenerator = function(generatorUrl, generatorDirectory, tempDir, cb) {
    download(generatorUrl).then(data => {

        fs.writeFile(tempDir+'/generator.zip', data, function() {
            const writeStream = unzip.Extract({ path: tempDir });
            const readStream = fs.createReadStream(tempDir+'/generator.zip');
            readStream.pipe(writeStream);

            writeStream.on('finish', function () {
                setTimeout(function() {
                    copy(tempDir+'/'+generatorDirectory, tempDir+'/build', function(err, results) {
                        cb();
                    });
                }, 100);
            });
        });
    });
};

server.route({
    method: 'GET',
    path:'/build/{project}/{secret}',
    handler: function (request, reply) {
        const project = request.params.project;
        const secret = request.params.secret;

        if (!config[project] || config[project].secret !== secret) {
            return reply('project unknown');
        }

        if (!fs.existsSync('./temp/'+project)){
            fs.mkdirSync('./temp/'+project);
        }

        if (!fs.existsSync('./temp/'+project+'/build')){
            fs.mkdirSync('./temp/'+project+'/build');
        }

        downloadContent(config[project].content, config[project].contentDirectory, './temp/'+project, function(){
            downloadGenerator(config[project].generator, config[project].generatorDirectory, './temp/'+project, function(){
                exec('npm install', {
                  cwd: './temp/'+project+'/build'
                }, function(error, stdout, stderr) {

                    exec('npm run generate', {
                      cwd: './temp/'+project+'/build'
                    }, function(error, stdout, stderr) {

                        exec('ls', {
                          cwd: './temp/'+project+'/build/generated'
                        }, function(error, stdout, stderr) {
                            rmdir(config[project].path);

                            copy('./temp/'+project+'/build/generated', config[project].path, function(err, results) {
                                rmdir('./temp/'+project);
                                return reply('project triggered');
                            });
                        });
                    });
                });
            });
        });
    }
});

server.start((err) => {
    if (!fs.existsSync('./temp')){
        fs.mkdirSync('./temp');
    }

    if (err) {
        throw err;
    }
    console.log('Server running at:', server.info.uri);
});

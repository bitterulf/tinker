const Hapi = require('hapi');
const config = require('./config.json');
const fs = require('fs');
const download = require('download');
const unzip = require('unzip');
const copy = require('recursive-copy');
const rmdir = require('rmdir');

const server = new Hapi.Server();

server.connection({
    host: 'localhost',
    port: 8000
});

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

        download(config[project].content).then(data => {

            fs.writeFile('./temp/'+project+'/content.zip', data, function() {
                const writeStream = unzip.Extract({ path: './temp/'+project });
                const readStream = fs.createReadStream('./temp/'+project+'/content.zip');
                readStream.pipe(writeStream);

                writeStream.on('finish', function () {
                    setTimeout(function() {
                        copy('temp/'+project+'/documents-master', 'temp/'+project+'/build/content', function(err, results) {

                            rmdir('./temp/'+project);

                            return reply('project triggered');
                        });
                    }, 100);
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

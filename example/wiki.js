var level = require('level');
var minimist = require('minimist');
var isarray = require('isarray');
var wikidb = require('../');

var db = level('/tmp/wiki.db');
var wdb = wikidb(db, { dir: '/tmp/wiki.blob' });

var argv = minimist(process.argv.slice(2));
if (argv._[0] === 'heads') {
    wdb.heads().on('data', console.log);
}
else if (argv._[0] === 'recent') {
    wdb.recent().on('data', console.log);
}
else if (argv._[0] === 'create') {
    var meta = { key: argv._[1] };
    if (isarray(argv.prev)) {
        meta.prev = argv.prev;
    }
    else if (argv.prev) {
        meta.prev = [ argv.prev ];
    }
    var w = wdb.createWriteStream(meta, function (err, key) {
        if (err) error(err)
        else console.log(key)
    });
    process.stdin.pipe(w);
}
else {
    console.error('unknown command');
}

function error (msg) {
    console.error(msg);
    process.exit(1);
}

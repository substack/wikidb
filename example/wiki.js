var level = require('level');
var minimist = require('minimist');
var wikidb = require('../');

var db = level('/tmp/wiki.db');
var wdb = wikidb(db, { dir: '/tmp/wiki.blob' });

var argv = minimist(process.argv.slice(2));
if (argv._[0] === 'keys') {
    wdb.keys().on('data', console.log);
}
else if (argv._[0] === 'heads') {
    wdb.heads(argv._[1]).on('data', console.log);
}
else if (argv._[0] === 'recent') {
    wdb.recent({ key: argv._[1] }).on('data', console.log);
}
else if (argv._[0] === 'by-tag') {
    wdb.byTag(argv._[1]).on('data', console.log);
}
else if (argv._[0] === 'create') {
    var meta = { key: argv._[1] };
    if (argv.prev) meta.prev = [].concat(argv.prev);
    if (argv.tag || argv.tags) {
        meta.tags = [].concat(argv.tag).concat(argv.tags).filter(Boolean);
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

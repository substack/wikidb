var wikidb = require('../');
var db = require('level')('/tmp/wiki.db');
var minimist = require('minimist');
var argv = minimist(process.argv.slice(2), {
    alias: { t: [ 'tag', 'tags' ] }
});

var wdb = wikidb(db, { dir: '/tmp/wiki.blob' });
var opts = {
    key: argv._[0],
    prev: argv.prev,
    tags: argv.tag
};
var w = wdb.createWriteStream(opts, function (err, key) {
    console.log(key);
});
process.stdin.pipe(w);

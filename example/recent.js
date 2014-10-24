var wikidb = require('../');
var db = require('level')('/tmp/wiki.db');
var wdb = wikidb(db, { dir: '/tmp/wiki.blob' });
var through = require('through2');

wdb.recent().pipe(through.obj(function (row, enc, next) {
    console.log('key:  ' + row.meta.key);
    console.log('hash: ' + row.hash);
    console.log('date: ' + new Date(row.meta.time));
    console.log('-----------------------------');
    var r = wdb.createReadStream(row.hash);
    r.pipe(process.stdout);
    r.on('end', function () { console.log(); next() });
}));

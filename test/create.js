var wikidb = require('../');
var level = require('level')
var test = require('tape');
var concat = require('concat-stream');
var path = require('path');
var mkdirp = require('mkdirp');
var through = require('through2');

var tmpdir = path.join(
    require('osenv').tmpdir(),
    'wikidb-test-' + Math.random()
);
mkdirp.sync(path.join(tmpdir, 'db'));

test('create', function (t) {
    t.plan(3);
    
    var db = level(path.join(tmpdir, 'db'));
    var wdb = wikidb(db, { dir: path.join(tmpdir, 'blob') });
    var opts = { key: 'msg' };
    var w = wdb.createWriteStream(opts, function (err, hash) {
        t.ifError(err);
        wdb.createReadStream(hash).pipe(concat(function (body) {
            t.equal(body.toString('utf8'), 'beep boop');
        }));
        wdb.heads('msg').pipe(collect(function (rows) {
            t.deepEqual(rows, [ { hash: hash } ]);
        }));
    });
    w.end('beep boop');
});

function collect (cb) {
    var rows = [];
    return through.obj(write, end);
    function write (row, enc, next) { rows.push(row); next() }
    function end () { cb(rows) }
}

var wikidb = require('../');
var level = require('level');
var through = require('through2');
var test = require('tape');
var concat = require('concat-stream');
var path = require('path');
var mkdirp = require('mkdirp');

var hashes = [
    '04765653b991c2e4d3a0e48e1f4163e15658e246ecd023f9514a0565c1cd0af2'
];
var tmpdir = path.join(
    require('osenv').tmpdir(),
    'wikidb-test-' + Math.random()
);
mkdirp.sync(path.join(tmpdir, 'db'));

var db = level(path.join(tmpdir, 'db'));
var wdb = wikidb(db, { dir: path.join(tmpdir, 'blob') });

test('populate recent', function (t) {
    t.plan(2);
    var opts = { key: 'msg', time: 12345678 };
    var w = wdb.createWriteStream(opts, function (err, hash) {
        t.ifError(err);
        t.equal(hash, hashes[0]);
    });
    w.end('beep boop');
});

test('recent', function (t) {
    t.plan(3);
    
    var opts = { key: 'msg' };
    var r = wdb.recent();
    
    r.pipe(through.obj(function (row, enc, next) {
        t.equal(row.meta.key, 'msg');
        t.equal(row.hash, hashes[0]);
        
        var r = wdb.createReadStream(row.hash);
        r.pipe(concat(function (body) {
            t.equal(body.toString('utf8'), 'beep boop');
            next();
        }));
    }));
});

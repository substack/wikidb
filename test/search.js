var wikidb = require('../');
var level = require('level');
var through = require('through2');
var test = require('tape');
var concat = require('concat-stream');
var path = require('path');
var mkdirp = require('mkdirp');

var tmpdir = path.join(
    require('osenv').tmpdir(),
    'wikidb-test-' + Math.random()
);
mkdirp.sync(path.join(tmpdir, 'db'));

var db = level(path.join(tmpdir, 'db'));
var wdb = wikidb(db, { dir: path.join(tmpdir, 'blob') });

test('populate search', function (t) {
    t.plan(2);
    var aopts = { key: 'msg', time: 12345678 };
    var a = wdb.createWriteStream(aopts, function (err, hash) {
        t.ifError(err);
    });
    a.end('beep boop\nwow\n');
    
    var bopts = { key: 'zzz', time: 7891231 };
    var b = wdb.createWriteStream(bopts, function (err, hash) {
        t.ifError(err);
    });
    b.end('zoom zip zing beep');
});

test('search results', function (t) {
    t.plan(4);
    
    wdb.search('wow').pipe(collect(function (results) {
        t.deepEqual(results.map(function (x) { return x.key }), [ 'msg' ]);
    }));
    wdb.search('zing').pipe(collect(function (results) {
        t.deepEqual(results.map(function (x) { return x.key }), [ 'zzz' ]);
    }));
    wdb.search('wooo').pipe(collect(function (results) {
        t.deepEqual(results, []);
    }));
    wdb.search('beep').pipe(collect(function (results) {
        t.deepEqual(
            results.map(function (x) { return x.key }).sort(),
            [ 'msg', 'zzz' ]
        );
    }));
});

function collect (cb) {
    var rows = [];
    return through.obj(write, end);
    function write (row, enc, next) { rows.push(row); next() }
    function end () { cb(rows) }
}

#!/usr/bin/env node

var level = require('level');
var minimist = require('minimist');
var wikidb = require('../');
var path = require('path');
var defined = require('defined');
var mkdirp = require('mkdirp');

var showHistory = require('forkdb/bin/lib/show_history.js');
var showFuture = require('forkdb/bin/lib/show_future.js');

var argv = minimist(process.argv.slice(2), {
    alias: { d: 'datadir' },
    default: { datadir: defined(process.env.WIKIDB_DIR, './wiki') }
});
var dbdir = path.join(argv.datadir, 'db');
var blobdir = path.join(argv.datadir, 'blob');

mkdirp.sync(dbdir);
mkdirp.sync(blobdir);

var db = level(dbdir);
var wdb = wikidb(db, { dir: blobdir });
var cmd = argv._[0];

if (cmd === 'keys') {
    var r = wdb.keys();
    r.on('data', console.log);
    r.on('end', function () { db.close() });
}
else if (cmd === 'list') {
    var r = wdb.list();
    r.on('data', console.log);
    r.on('end', function () { db.close() });
}
else if (cmd === 'heads') {
    var r = wdb.heads(argv._[1]);
    r.on('data', console.log);
    r.on('end', function () { db.close() });
}
else if (cmd === 'recent') {
    var r = wdb.recent({ key: argv._[1] })
    r.on('data', console.log);
    r.on('end', function () { db.close() });
}
else if (cmd === 'history') {
    showHistory(wdb, argv._[1], function () { db.close() });
}
else if (cmd === 'future') {
    showFuture(wdb, argv._[1], function () { db.close() });
}
else if (cmd === 'by-tag') {
    var r = wdb.byTag(argv._[1]);
    r.on('data', console.log);
    r.on('end', function () { db.close() });
}
else if (cmd === 'search') {
    var r = wdb.search(argv._.slice(1));
    r.on('data', console.log);
    r.on('end', function () { db.close() });
}
else if (cmd === 'get') {
    wdb.get(argv._[1], function (err, meta) {
        if (err) error(err)
        else console.log(meta)
        db.close();
    });
}
else if (cmd === 'sync' || cmd === 'pull' || cmd === 'push') {
    var r = wdb.replicate({ mode: cmd });
    process.stdin.pipe(r).pipe(process.stdout);
    r.on('end', function () { db.close() });
}
else if (cmd === 'create') {
    var meta = { key: argv._[1] };
    if (argv.prev) meta.prev = [].concat(argv.prev);
    if (argv.tag || argv.tags) {
        meta.tags = [].concat(argv.tag).concat(argv.tags).filter(Boolean);
    }
    var w = wdb.createWriteStream(meta, function (err, key) {
        if (err) error(err)
        else console.log(key)
        db.close();
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

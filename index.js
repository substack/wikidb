var ForkDB = require('forkdb');
var inherits = require('inherits');
var through = require('through2');
var defined = require('defined');
var readonly = require('read-only-stream');
var split = require('split');

module.exports = WikiDB;
inherits(WikiDB, ForkDB);

function WikiDB (db, opts) {
    if (!(this instanceof WikiDB)) return new WikiDB(db, opts);
    if (!opts) opts = {};
    ForkDB.call(this, db, opts);
}

WikiDB.prototype.createWriteStream = function (meta, cb) {
    var self = this;
    if (!meta) meta = {};
    if (!meta.time) meta.time = Date.now();
    
    var tags = [].concat(meta.tags).filter(Boolean);
    var opts = { prebatch: prebatch };
    return ForkDB.prototype.createWriteStream.call(this, meta, opts, cb);
    
    function prebatch (rows, wkey, cb_) {
        rows.push({
            type: 'put',
            key: [ 'wiki', meta.time, meta.key ],
            value: wkey
        });
        rows.push({
            type: 'put',
            key: [ 'wiki-key', meta.key, meta.time ],
            value: wkey
        });
        
        var isHead = false, prevHead = null;;
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            if (row.type === 'put' && row.key[0] === 'head') {
                isHead = true;
            }
            else if (row.type === 'del' && row.key[0] === 'head') {
                prevHead = row.key.slice(1);
            }
        }
        
        if (isHead) {
            tags.forEach(function (tag) {
                rows.push({
                    type: 'put',
                    key: [ 'wiki-tag', tag, meta.key, wkey ],
                    value: 0
                });
            });
            if (tags.length) {
                rows.push({
                    type: 'put',
                    key: [ 'wiki-tags', meta.key, wkey ],
                    value: tags
                });
            }
        }
        if (isHead && prevHead) {
            var pkey = [ 'wiki-tags' ].concat(prevHead);
            self.db.get(pkey, function (err, prev) {
                if (err) return cb_(null, rows)
                rows.push({ type: 'del', key: pkey });
                prev.forEach(function (p) {
                    rows.push({
                        type: 'del',
                        key: [ 'wiki-tag', p ].concat(prevHead)
                    });
                });
                cb_(null, rows);
            });
        }
        else cb_(null, rows)
    }
};

WikiDB.prototype.byTag = function (opts, cb) {
    if (!opts) opts = {};
    if (typeof opts === 'string') opts = { tag: opts };
    var r = this.db.createReadStream({
        gt: [ 'wiki-tag', opts.tag, defined(opts.gt, null) ],
        lt: [ 'wiki-tag', opts.tag, defined(opts.lt, undefined) ],
        limit: opts.limit
    });
    var output = readonly(r.pipe(through.obj(write)));
    r.on('error', function (err) { output.emit('error', err) });
    if (cb) {
        output.pipe(collect(cb));
        output.on('error', cb);
    }
    return output;
    
    function write (row, enc, next) {
        this.push({ key: row.key[2], hash: row.key[3] });
        next();
    }
};

WikiDB.prototype.search = function (terms, opts) {
    var self = this;
    if (!opts) opts = {};
    if (typeof terms === 'string') terms = terms.split(/\s+/);
    
    return this.heads().pipe(through.obj(function (row, enc, next) {
        var output = this;
        var matches = terms.slice();
        var pending = 2;
        row.key.split(/[^\w~-]/).forEach(ifmatch);
        
        self.get(row.hash, function (err, meta) {
            if (meta && meta.tags) {
                meta.tags.forEach(ifmatch);
            }
            end();
        });
        var words = through(function (buf, enc, next) {
            ifmatch(buf.toString('utf8'));
            if (matches.length) next();
        }, end);
        self.createReadStream(row.hash).pipe(split(/[^\w~-]/)).pipe(words);
        
        function ifmatch (word) {
            var ix = matches.indexOf(word);
            if (ix < 0) return;
            matches.splice(ix, 1);
            if (matches.length === 0) {
                output.push(row);
                next();
            }
        }
        function end () {
            if (matches.length !== 0 && -- pending === 0) next();
        }
    }));
};

WikiDB.prototype.recent = function (opts) {
    if (!opts) opts = {};
    var self = this;
    var sopts;
    if (opts.key) {
        sopts = {
            gt: [ 'wiki-key', opts.key, defined(opts.gt, null) ],
            lt: [ 'wiki-key', opts.key, opts.lt ]
        };
    }
    else {
        sopts = {
            gt: [ 'wiki', defined(opts.gt, null) ],
            lt: [ 'wiki', opts.lt ]
        };
    }
    if (opts.limit !== undefined) sopts.limit = opts.limit;
    
    var s = self.db.createReadStream(sopts);
    var tr = through.obj(function (row, enc, next) {
        self.get(row.value, function (err, meta) {
            tr.push({ hash: row.value, meta: meta });
            next();
        });
    });
    s.on('error', function (err) { tr.emit('error', err) });
    return s.pipe(tr);
};

function collect (cb) {
    var rows = [];
    return through.obj(write, end);
    function write (row, enc, next) { rows.push(row); next() }
    function end () { cb(null, rows) }
}

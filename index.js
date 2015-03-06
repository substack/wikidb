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

WikiDB.prototype.createWriteStream = function (meta, opts, cb) {
    var self = this;
    if (!meta) meta = {};
    if (!meta.time) meta.time = Date.now();
    if (typeof opts === 'function') {
        cb = opts;
        opts = {};
    }
    if (!opts) opts = {};
    var pre = opts.prebatch;
    opts.prebatch = prebatch;
    
    var tags = [].concat(meta.tags).filter(Boolean);
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
                if (pre) pre(rows, wkey, cb_)
                else cb_(null, rows);
            });
        }
        else {
            if (pre) pre(rows, wkey, cb_)
            else cb_(null, rows)
        }
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
    return readonly(this.keys().pipe(through.obj(kwrite, kend)));
    
    function kwrite (krow, enc, knext) {
        var kstream = this;
        var h = self.heads(krow.key);
        var hstream = h.pipe(through.obj(hwrite, function () { knext() }));
        h.on('error', function (err) { hstream.emit('error', err) });
        
        function hwrite (hrow, enc, hnext) {
            var pending = terms.slice();
            
            var r = self.createReadStream(hrow.hash);
            r.on('error', function (err) { hstream.emit('error', err) });
            r.pipe(split()).pipe(through(function (line, enc, next) {
                for (var i = 0; i < pending.length; i++) {
                    var t = pending[i];
                    if (line.toString('utf8').indexOf(t) >= 0) {
                        pending.splice(i, 1);
                        i--;
                    }
                }
                if (pending.length === 0) {
                    kstream.push({ hash: hrow.hash, key: krow.key });
                    hnext();
                }
                else next();
            }, function () { hnext() }));
        }
    }
    function kend () { this.push(null) }
};

WikiDB.prototype.recent = function (opts, cb) {
    if (!opts) opts = {};
    var self = this;
    var sopts;
    if (opts.key) {
        sopts = {
            gt: [ 'wiki-key', opts.key, defined(opts.gt, null) ],
            lt: [ 'wiki-key', opts.key, opts.lt ],
            limit: opts.limit,
            reverse: !opts.reverse
        };
    }
    else {
        sopts = {
            gt: [ 'wiki', defined(opts.gt, null) ],
            lt: [ 'wiki', opts.lt ],
            limit: opts.limit,
            reverse: !opts.reverse
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
    if (cb) {
        tr.on('error', cb);
        tr.pipe(collect(cb));
    }
    return s.pipe(tr);
};

function collect (cb) {
    var rows = [];
    return through.obj(write, end);
    function write (row, enc, next) { rows.push(row); next() }
    function end () { cb(null, rows) }
}

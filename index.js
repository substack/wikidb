var ForkDB = require('forkdb');
var inherits = require('inherits');
var through = require('through2');
var inherits = require('inherits');
var defined = require('defined');
var combine = require('stream-combiner2');

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
            key: [ 'wiki', Date.now(), meta.key ],
            value: wkey
        });
        rows.push({
            type: 'put',
            key: [ 'wiki-key', meta.key, Date.now() ],
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

WikiDB.prototype.byTag = function (opts) {
    if (!opts) opts = {};
    if (typeof opts === 'string') opts = { tag: opts };
    var r = this.db.createReadStream({
        gt: [ 'wiki-tag', opts.tag, defined(opts.gt, null) ],
        lt: [ 'wiki-tag', opts.tag, defined(opts.lt, undefined) ]
    });
    return combine([ r, through.obj(write) ]);
    
    function write (row, enc, next) {
        this.push({
            key: row.key[2],
            hash: row.key[3]
        });
        next();
    }
};

WikiDB.prototype.search = function (terms) {
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
    var s = self.db.createReadStream(sopts);
    var tr = through.obj(function (row, enc, next) {
        self.getMeta(row.value, function (err, meta) {
            tr.push({ hash: row.value, meta: meta });
            next();
        });
    });
    s.on('error', function (err) { tr.emit('error', err) });
    return s.pipe(tr);
};

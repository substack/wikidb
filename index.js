var ForkDB = require('forkdb');
var inherits = require('inherits');
var through = require('through2');
var inherits = require('inherits');
var defined = require('defined');

module.exports = WikiDB;
inherits(WikiDB, ForkDB);

function WikiDB (db, opts) {
    if (!(this instanceof WikiDB)) return new WikiDB(db, opts);
    if (!opts) opts = {};
    ForkDB.call(this, db, opts);
}

WikiDB.prototype.createWriteStream = function (meta, cb) {
    if (!meta) meta = {};
    if (!meta.time) meta.time = Date.now();
    var opts = {
        prebatch: function (rows, wkey) {
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
            return rows;
        }
    };
    return ForkDB.prototype.createWriteStream.call(this, meta, opts, cb);
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

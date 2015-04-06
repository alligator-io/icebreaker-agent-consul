var moment = require('moment')
var _ = require('icebreaker')
require('icebreaker-agent')

if (!_.agents) _.mixin({
  agents: {}
})

function isFunction(obj) {
  return typeof obj === 'function'
}

_.mixin({
  consul: _.agent({
    name: 'consul',
    host: 'localhost',
    port: 8500,
    interval: 1000,
    prefix: 'icebreaker-',
    peers: [],
    secure: false,
    ca: null,
    start: function () {
      var consul = require('consul')({
        host: this.host,
        port: this.port,
        secure: this.secure,
        ca: this.ca
      })

      var self = this
      this.consul = consul

      function list() {
        return isFunction(self.peers) ? self.peers() : self.peers
      }

      _(
        list(),
        _.asyncMap(function (p, cb) {
          if (p.enabled == null || p.enabled === true) {
            consul.agent.service.register({
              name: self.prefix + p.name,
              address: p.address,
              port: p.port,
              tags: ['icebreaker'],
              check: {
                ttl: '' + moment.duration(self.interval * 2).asSeconds() + 's'
              }
            },
            function (err) {
              if (err) return cb(err)
              cb(null, p)
            })
          }
        }),
        _.onEnd(function (err) {
          if (err) throw err

          this.timer = setInterval(function () {
            consul.catalog.service.list({
              tag: 'icebreaker'
            },
            function (err, services) {
              if (err) return console.error(err)

              _(
                _.keys(services),
                _.filter(function (service) {
                  return services[service].indexOf('icebreaker') >= 0
                }),
                _.asyncMap(function (m, cb) {
                  consul.health.service({service:m,tag:'icebreaker',passing:true}, function(err, r) {
                    cb(err,!err?r:null)
                  })
                  return m
                }),
                _.flatten(),
                _.map(function (item) {
                  return {
                    name: item.Service.ID.replace(self.prefix, ''),
                    address: item.Service.Address,
                    port: item.Service.Port
                  }
                }),
                _.asyncMap(function (peer, cb) {
                  _(list(), _.find(function (p) {
                    return p.name === peer.name && (peer.enabled == null || peer.enabled === true) && p.auto === true
                  }, function (err, found) {
                    if (err) return cb(err)
                    cb(null, found != null ? peer : null)
                  }))
                }),
                _.filter(function (p) {
                  return p != null
                }),
                self.connect()
              )
            })

            _(list(), _.drain(function (p) {
              consul.agent.check.pass('service:' + self.prefix + p.name, function (err) {
                if (err) return console.error(err)
              })
            }))

          },
          this.interval
          )

          this.emit('started')

        }.bind(this)))
    },
    stop: function () {
      if (this.timer != null) {
        clearInterval(this.timer)
        this.timer = null
        this.consul = null
      }
      this.emit('stopped')
    }
  })
}, _.agents)

# icebreaker-agent-consul
Consul agent for icebreaker peers.
## Install
```bash
npm install icebreaker-agent-consul
```
## Usage
```javascript
var _ = require('icebreaker')
require('icebreaker-peer-net')
require('icebreaker-agent-consul')

var peer =  _.peers.net({port:8986})
peer.start()

var agent = _.agents.consul({peers:[peer],host:'localhost'})
agent.once('started',function(){
  console.log('started')
})

agent.start()
```
## Licence
MIT


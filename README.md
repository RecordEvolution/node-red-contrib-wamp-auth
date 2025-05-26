node-red-ironflock
===================

A <a href="http://nodered.org" target="_new">Node-RED</a> node to wrap wamp client (with authentication) as one of these roles (publisher, subscriber, caller and callee).
Forked from <a href="https://www.npmjs.com/package/node-red-contrib-wamp" target="_new">node-red-contrib-wamp</a>.

Install
-------

Run the following command in your Node-RED user directory - typically `~/.node-red`

    npm install @record-evolution/node-red-ironflock


Usage
-----
Connects to a WAMP router to publish and subscribe messages according to one topic or call remote WAMP client or register a callee for remote client to call it.